const { PrismaClient } = require('@prisma/client');
const { callChatWithRoundRobin } = require('./ai');

const prisma = new PrismaClient();

async function handleAgentChat(messages, sessionId) {

    const plans = await prisma.plan.findMany({
        include: { workouts: true, mealSchedules: true }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const dailyLog = await prisma.dailyLog.findUnique({
        where: { date: todayStr },
        include: { foodLogs: true, workoutLogs: true }
    });

    const systemPrompt = `
You are AI Fitness Tracker, an AI fitness and nutrition agent.
Here is the user's current weekly plan in JSON format:
${JSON.stringify(plans)}

Here is the user's daily food log, workout log, and stats for today (${todayStr}) in JSON format:
${JSON.stringify(dailyLog || { totalCalories: 0, totalProtein: 0, foodLogs: [], workoutLogs: [] })}

Your job is to answer their questions about training and nutrition.
You can ALSO act as a personal assistant to update their plan, log food/workouts, or manage logs based on their requests.
To perform these actions, you MUST output your response AND append a special JSON command at the very end of your response to update the database.
If they ask to log food, estimate the calories and protein yourself if they don't provide them.

Available JSON commands (append ONLY ONE at the end if an action is needed, EXACTLY in this format):

1. To change the weekly plan:
@@UPDATE_PLAN@@
{
  "dayOfWeek": "monday",
  "workouts": [ { "name": "Bench Press", "reps": "4x10", "video": "url" } ]
}
(Only include fields to change: "workouts", "mealSchedules", "isRestDay")

2. To log new food:
@@LOG_FOOD@@
{
  "description": "2 eggs and toast",
  "calories": 300,
  "protein": 18
}

3. To edit an existing food log (use the exact 'id' from today's food log JSON):
@@EDIT_FOOD@@
{
  "id": "food-log-id-here",
  "calories": 400,
  "protein": 25
}

4. To delete a food log (use the exact 'id' from today's food log JSON):
@@DELETE_FOOD@@
{
  "id": "food-log-id-here"
}

5. To log a completed workout (optionally matching a workout ID from today's plan):
@@LOG_WORKOUT@@
{
  "name": "Standard Push-ups",
  "reps": "2x10",
  "workoutId": "optional-workout-id-here"
}

6. To delete a workout log (use the exact 'id' from today's workout log JSON):
@@DELETE_WORKOUT@@
{
  "id": "workout-log-id-here"
}

7. To update system configurations (like AI providers or WhatsApp whitelist number):
@@UPDATE_CONFIG@@
{
  "key": "ai_providers",
  "value": "[\"gemini\"]"
}

If no action is needed (just answering a question or giving advice), just reply normally in markdown. Do NOT append any command blocks unless you are explicitly taking an action to update the database.
`;


    const apiMessages = [
        { role: 'user', content: systemPrompt },
        { role: 'model', content: 'Understood. How can I help you today?' },
        ...messages
    ];


    if (messages.length > 0 && sessionId) {
        const lastUserMessage = messages[messages.length - 1];
        await prisma.agentMessage.create({
            data: { role: 'user', content: lastUserMessage.content, sessionId }
        });
        
        // Optionally update the session title if it's still "New Chat" and this is the first message
        if (messages.length === 1) {
            const newTitle = lastUserMessage.content.substring(0, 30) + (lastUserMessage.content.length > 30 ? '...' : '');
            await prisma.agentSession.update({
                where: { id: sessionId },
                data: { title: newTitle }
            });
            
            await prisma.activityLog.create({
                data: {
                    action: 'AI_SESSION_STARTED',
                    details: JSON.stringify({ source: 'web_agent', title: newTitle })
                }
            });
        } else {
            await prisma.activityLog.create({
                data: {
                    action: 'AI_CHAT_MESSAGE',
                    details: JSON.stringify({ source: 'web_agent', message: lastUserMessage.content.substring(0, 50) + '...' })
                }
            });
        }
    }

    let responseText = await callChatWithRoundRobin(apiMessages);

    let reply = responseText;
    

    const match = responseText.match(/@@(UPDATE_PLAN|LOG_FOOD|EDIT_FOOD|DELETE_FOOD|DELETE_WORKOUT|LOG_WORKOUT|UPDATE_CONFIG)@@/);

    if (match) {
        const action = match[1];
        const updateIndex = responseText.indexOf(match[0]);
        reply = responseText.substring(0, updateIndex).trim();
        const jsonStr = responseText.substring(updateIndex + match[0].length).trim();
        
        try {
            const updateData = JSON.parse(jsonStr);

            if (action === 'UPDATE_PLAN') {
                if (updateData.dayOfWeek) {
                    const dayStr = updateData.dayOfWeek.toLowerCase();
                    const plan = await prisma.plan.findUnique({ where: { dayOfWeek: dayStr } });

                    if (plan) {
                        if (updateData.isRestDay !== undefined) {
                            await prisma.plan.update({
                                where: { id: plan.id },
                                data: { isRestDay: updateData.isRestDay }
                            });
                        }
                        if (updateData.workouts) {
                            await prisma.workout.deleteMany({ where: { planId: plan.id } });
                            await prisma.plan.update({
                                where: { id: plan.id },
                                data: { workouts: { create: updateData.workouts } }
                            });
                        }
                        if (updateData.mealSchedules) {
                            await prisma.mealSchedule.deleteMany({ where: { planId: plan.id } });
                            await prisma.plan.update({
                                where: { id: plan.id },
                                data: { mealSchedules: { create: updateData.mealSchedules } }
                            });
                        }
                        await prisma.activityLog.create({
                            data: {
                                action: 'PLAN_UPDATED',
                                details: JSON.stringify({ source: 'web_agent', dayOfWeek: dayStr })
                            }
                        });
                        reply += '\n\n*(I have automatically updated your plan!)*';
                    }
                }
            } else if (action === 'LOG_FOOD') {
                let dLog = await prisma.dailyLog.findUnique({ where: { date: todayStr } });
                if (!dLog) {
                    dLog = await prisma.dailyLog.create({ data: { date: todayStr } });
                }

                await prisma.foodLog.create({
                    data: {
                        description: updateData.description,
                        calories: parseInt(updateData.calories) || 0,
                        protein: parseInt(updateData.protein) || 0,
                        dailyLogId: dLog.id
                    }
                });

                await prisma.dailyLog.update({
                    where: { id: dLog.id },
                    data: {
                        totalCalories: { increment: parseInt(updateData.calories) || 0 },
                        totalProtein: { increment: parseInt(updateData.protein) || 0 }
                    }
                });

                await prisma.activityLog.create({
                    data: {
                        action: 'FOOD_LOGGED',
                        details: JSON.stringify({ source: 'web_agent', description: updateData.description, calories: updateData.calories })
                    }
                });
                reply += '\n\n*(I have automatically logged this food for today!)*';

            } else if (action === 'EDIT_FOOD') {
                const foodLog = await prisma.foodLog.findUnique({ where: { id: updateData.id } });
                if (foodLog) {
                    const calDiff = (parseInt(updateData.calories) || 0) - foodLog.calories;
                    const proDiff = (parseInt(updateData.protein) || 0) - foodLog.protein;

                    await prisma.foodLog.update({
                        where: { id: updateData.id },
                        data: {
                            calories: parseInt(updateData.calories) || 0,
                            protein: parseInt(updateData.protein) || 0,
                        }
                    });

                    await prisma.dailyLog.update({
                        where: { id: foodLog.dailyLogId },
                        data: {
                            totalCalories: { increment: calDiff },
                            totalProtein: { increment: proDiff }
                        }
                    });

                    await prisma.activityLog.create({
                        data: {
                            action: 'FOOD_EDITED',
                            details: JSON.stringify({ source: 'web_agent', id: updateData.id })
                        }
                    });
                    reply += '\n\n*(I have automatically updated this food log!)*';
                } else {
                    reply += '\n\n*(I could not find that food log to edit.)*';
                }

            } else if (action === 'DELETE_FOOD') {
                const foodLog = await prisma.foodLog.findUnique({ where: { id: updateData.id } });
                if (foodLog) {
                    await prisma.foodLog.delete({ where: { id: updateData.id } });
                    await prisma.dailyLog.update({
                        where: { id: foodLog.dailyLogId },
                        data: {
                            totalCalories: { decrement: foodLog.calories },
                            totalProtein: { decrement: foodLog.protein }
                        }
                    });

                    await prisma.activityLog.create({
                        data: {
                            action: 'FOOD_DELETED',
                            details: JSON.stringify({ source: 'web_agent', id: updateData.id })
                        }
                    });
                    reply += '\n\n*(I have deleted this food log!)*';
                } else {
                    reply += '\n\n*(I could not find that food log to delete.)*';
                }
            } else if (action === 'DELETE_WORKOUT') {
                const workoutLog = await prisma.workoutLog.findUnique({ where: { id: updateData.id } });
                if (workoutLog) {
                    await prisma.workoutLog.delete({ where: { id: updateData.id } });
                    await prisma.activityLog.create({
                        data: {
                            action: 'WORKOUT_DELETED',
                            details: JSON.stringify({ source: 'web_agent', id: updateData.id })
                        }
                    });
                    reply += '\n\n*(I have automatically removed this workout log!)*';
                } else {
                    reply += '\n\n*(I could not find that workout log to delete.)*';
                }
            } else if (action === 'LOG_WORKOUT') {
                let dLog = await prisma.dailyLog.findUnique({ where: { date: todayStr } });
                if (!dLog) {
                    dLog = await prisma.dailyLog.create({ data: { date: todayStr } });
                }

                let matchedWorkout = null;
                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const currentDay = days[new Date().getDay()];
                const todayPlan = plans.find(p => p.dayOfWeek === currentDay);
                if (todayPlan && todayPlan.workouts) {
                    if (updateData.workoutId) {
                        matchedWorkout = todayPlan.workouts.find(w => w.id === updateData.workoutId);
                    } else if (updateData.name) {
                        matchedWorkout = todayPlan.workouts.find(w => 
                            w.name.toLowerCase().includes(updateData.name.toLowerCase()) ||
                            updateData.name.toLowerCase().includes(w.name.toLowerCase())
                        );
                    }
                }

                const finalName = matchedWorkout ? matchedWorkout.name : (updateData.name || 'Workout');
                const finalReps = updateData.reps || (matchedWorkout ? matchedWorkout.reps : '1 session');
                const workoutId = matchedWorkout ? matchedWorkout.id : (updateData.workoutId || null);

                let existingLog = null;
                if (workoutId) {
                    existingLog = await prisma.workoutLog.findFirst({
                        where: { dailyLogId: dLog.id, workoutId: workoutId }
                    });
                }

                if (existingLog) {
                    await prisma.workoutLog.update({
                        where: { id: existingLog.id },
                        data: { reps: finalReps }
                    });
                    await prisma.activityLog.create({
                        data: {
                            action: 'WORKOUT_UPDATED',
                            details: JSON.stringify({ source: 'web_agent', name: finalName, reps: finalReps })
                        }
                    });
                    reply += `\n\n*(I have automatically updated this workout: ${finalName} (${finalReps})!)*`;
                } else {
                    await prisma.workoutLog.create({
                        data: {
                            name: finalName,
                            reps: finalReps,
                            workoutId: workoutId,
                            dailyLogId: dLog.id
                        }
                    });
                    await prisma.activityLog.create({
                        data: {
                            action: 'WORKOUT_LOGGED',
                            details: JSON.stringify({ source: 'web_agent', name: finalName, reps: finalReps })
                        }
                    });
                    reply += `\n\n*(I have automatically logged this workout: ${finalName} (${finalReps})!)*`;
                }
            } else if (action === 'UPDATE_CONFIG') {
                const existing = await prisma.config.findUnique({ where: { key: updateData.key } });
                if (existing) {
                    await prisma.config.update({
                        where: { key: updateData.key },
                        data: { value: updateData.value }
                    });
                } else {
                    await prisma.config.create({
                        data: { key: updateData.key, value: updateData.value }
                    });
                }

                await prisma.activityLog.create({
                    data: {
                        action: 'CONFIG_UPDATED',
                        details: JSON.stringify({ source: 'web_agent', key: updateData.key })
                    }
                });
                reply += '\n\n*(I have updated the system configuration!)*';
            }
        } catch (err) {
            console.error('Failed to parse or execute agent update:', err, jsonStr);
            reply += '\n\n*(I tried to perform your requested action, but encountered an error.)*';
        }
    }


    if (sessionId) {
        await prisma.agentMessage.create({
            data: { role: 'assistant', content: reply, sessionId }
        });
    }

    return reply;
}

module.exports = { handleAgentChat };
