const { PrismaClient } = require('@prisma/client');
const { estimateCalories } = require('./ai');

const prisma = new PrismaClient();

/**
 * Handles incoming messages from bot integrations, classifies intent,
 * manipulates the DB, and returns the appropriate reply string.
 *
 * @param {string} text - The user's incoming message
 * @param {string} platform - The source platform ('whatsapp' or 'telegram')
 * @param {function} sendReplyFn - Optional function to send immediate replies
 * @returns {Promise<string>} The text reply to send back to the user
 */
async function handleMessageIntent(text, platform, sendReplyFn) {
    const sourceLogName = platform === 'whatsapp' ? 'whatsapp_bot' : 'telegram_bot';

    // Log the message activity
    await prisma.activityLog.create({
        data: {
            action: 'AI_CHAT_MESSAGE',
            details: JSON.stringify({ source: sourceLogName, message: text.substring(0, 50) + (text.length > 50 ? '...' : '') })
        }
    });

    const lowerText = text.toLowerCase().trim();
    let intent = null;
    let target = '';

    const helpWords = ['help', 'menu', 'what can you do', 'commands', 'how to use', '/start', '/help'];
    const statsWords = ['calories today', 'how many calories', 'stats', 'progress', 'macros today', 'how much protein', 'total today', 'how many left', 'remaining', 'target'];
    const planWords = ['plan today', 'workout today', 'what.s my plan', 'what.s today', 'today.s plan', 'today.s workout', 'meal plan', 'what should i do'];
    const logsWords = ['what did i eat', 'show my log', 'show log', 'food log', 'list food', 'what i ate', 'my logs'];
    const deleteWords = ['delete', 'remove'];
    const editWords = ['edit', 'update', 'change', 'correct', 'fix'];
    const weeklyWords = ['weekly', 'this week', 'week progress', 'last 7', 'past week', 'week summary'];

    if (helpWords.some(w => lowerText.includes(w)) || lowerText === 'help' || lowerText === '?') {
        intent = 'HELP';
    } else if (weeklyWords.some(w => lowerText.includes(w))) {
        intent = 'GET_WEEKLY';
    } else if (editWords.some(w => lowerText.includes(w))) {
        intent = 'EDIT_FOOD';
        target = lowerText;
    } else if (statsWords.some(w => lowerText.includes(w))) {
        intent = 'GET_STATS';
    } else if (planWords.some(w => new RegExp(w).test(lowerText))) {
        intent = 'GET_PLAN';
    } else if (logsWords.some(w => lowerText.includes(w))) {
        intent = 'GET_LOGS';
    } else if (deleteWords.some(w => lowerText.includes(w))) {
        intent = 'DELETE_FOOD';
        const numMatch = lowerText.match(/#(\d+)/);
        if (numMatch) {
            target = numMatch[1];
        } else {
            const match = lowerText.match(/(?:delete|remove)\s+(?:the\s+)?(.+)/);
            if (match) target = match[1].trim();
        }
    }

    if (intent === null) {
        try {
            const { classifyBotIntent } = require('./ai');
            const aiResult = await classifyBotIntent(text);
            const validIntents = ['LOG_FOOD', 'GET_STATS', 'GET_PLAN', 'GET_LOGS', 'DELETE_FOOD', 'EDIT_FOOD', 'GET_WEEKLY', 'HELP', 'UNSUPPORTED'];

            if (aiResult && validIntents.includes(aiResult.intent)) {
                intent = aiResult.intent;
                if (aiResult.target) target = aiResult.target;
            } else {
                intent = 'UNSUPPORTED';
            }
        } catch (err) {
            console.error('AI intent classification failed:', err.message);
            intent = 'UNSUPPORTED';
        }
    }

    const getTodayTarget = async () => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayStr = days[new Date().getDay()];
        const plan = await prisma.plan.findUnique({
            where: { dayOfWeek: todayStr },
            include: { mealTarget: true }
        });
        return plan?.mealTarget || null;
    };

    const today = new Date().toISOString().split('T')[0];

    if (intent === 'LOG_FOOD') {
        if (sendReplyFn) {
            await sendReplyFn('🤔 Estimating...');
        }
        
        const result = await estimateCalories(text);

        let dailyLog = await prisma.dailyLog.findUnique({ where: { date: today } });
        if (!dailyLog) {
            dailyLog = await prisma.dailyLog.create({ data: { date: today } });
        }

        await prisma.foodLog.create({
            data: {
                description: result.description,
                calories: result.calories,
                protein: result.protein,
                dailyLogId: dailyLog.id
            }
        });

        await prisma.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
                totalCalories: { increment: result.calories },
                totalProtein: { increment: result.protein }
            }
        });

        await prisma.activityLog.create({
            data: {
                action: 'FOOD_LOGGED',
                details: JSON.stringify({ source: sourceLogName, description: result.description, calories: result.calories })
            }
        });

        return `✅ *Logged:* ${result.description}\n🔥 *Calories:* ${result.calories} kcal\n🥩 *Protein:* ${result.protein}g`;

    } else if (intent === 'GET_STATS') {
        const log = await prisma.dailyLog.findUnique({ where: { date: today } });
        const mealTarget = await getTodayTarget();

        if (!log) {
            return 'You haven\'t logged anything today yet! Get eating! 🍎';
        } else {
            let reply = `📊 *Today's Stats*\n🔥 Calories: ${log.totalCalories} kcal\n🥩 Protein: ${log.totalProtein}g`;

            if (mealTarget) {
                const targetCal = parseInt(mealTarget.calories) || 0;
                const targetPro = parseInt(mealTarget.protein) || 0;
                const remainCal = Math.max(0, targetCal - log.totalCalories);
                const remainPro = Math.max(0, targetPro - log.totalProtein);
                const pctCal = targetCal > 0 ? Math.round((log.totalCalories / targetCal) * 100) : 0;

                reply += `\n\n🎯 *Target:* ${targetCal} kcal / ${targetPro}g protein`;
                reply += `\n📉 *Remaining:* ${remainCal} kcal / ${remainPro}g protein`;
                reply += `\n📈 *Progress:* ${pctCal}%`;

                if (pctCal >= 100) reply += ` ✅ Target reached!`;
                else if (pctCal >= 75) reply += ` 🔥 Almost there!`;
                else if (pctCal >= 50) reply += ` 💪 Halfway!`;
            }
            return reply;
        }

    } else if (intent === 'GET_PLAN') {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayStr = days[new Date().getDay()];
        const plan = await prisma.plan.findUnique({
            where: { dayOfWeek: todayStr },
            include: { workouts: true, mealSchedules: true }
        });

        if (!plan) {
            return 'No plan set for today.';
        } else if (plan.isRestDay) {
            return `Today is a *Rest Day* (${plan.title}). Take it easy! 😴`;
        } else {
            let reply = `💪 *Today's Plan: ${plan.title}*\n\n*Workouts:*\n`;
            if (plan.workouts.length === 0) reply += 'No workouts scheduled.\n';
            for (const w of plan.workouts) {
                reply += `- ${w.name} (${w.reps})\n`;
            }
            reply += `\n*Meals:*\n`;
            if (plan.mealSchedules.length === 0) reply += 'No meals scheduled.\n';
            for (const m of plan.mealSchedules) {
                reply += `- ${m.time}: ${m.title} (${m.kcal})\n`;
            }
            return reply;
        }

    } else if (intent === 'GET_LOGS') {
        const log = await prisma.dailyLog.findUnique({
            where: { date: today },
            include: { foodLogs: { orderBy: { time: 'asc' } } }
        });
        if (!log || log.foodLogs.length === 0) {
            return 'You haven\'t logged any food today. 🍽️';
        } else {
            let reply = `📋 *Today's Food Log:*\n\n`;
            log.foodLogs.forEach((f, i) => {
                reply += `*#${i + 1}* ${f.description} (${f.calories} kcal, ${f.protein}g)\n`;
            });
            reply += `\n*Total:* ${log.totalCalories} kcal, ${log.totalProtein}g protein`;
            reply += `\n\n_Use "edit #1 300cal 20g" or "delete #2" to modify_`;
            return reply;
        }

    } else if (intent === 'DELETE_FOOD') {
        const log = await prisma.dailyLog.findUnique({
            where: { date: today },
            include: { foodLogs: { orderBy: { time: 'asc' } } }
        });

        if (!log || log.foodLogs.length === 0) {
            return 'You haven\'t logged anything today yet to delete.';
        }

        let toDeleteItems = [];
        const numMatches = lowerText.match(/#\d+/g);
        if (numMatches) {
            for (const match of numMatches) {
                const idx = parseInt(match.substring(1)) - 1;
                if (idx >= 0 && idx < log.foodLogs.length) {
                    toDeleteItems.push(log.foodLogs[idx]);
                }
            }
        }
        
        toDeleteItems = [...new Set(toDeleteItems)]; // Remove duplicates

        if (toDeleteItems.length === 0 && target) {
            const found = log.foodLogs.find(f => f.description.toLowerCase().includes(target.toLowerCase()));
            if (found) toDeleteItems.push(found);
        }

        if (toDeleteItems.length === 0) {
            return `I couldn't find that item. Use "show my logs" to see numbered items, then "delete #1" or "delete #1 and #2".`;
        }

        let totalCalDeleted = 0;
        let totalProDeleted = 0;
        let deletedDescriptions = [];

        for (const item of toDeleteItems) {
            await prisma.foodLog.delete({ where: { id: item.id } });
            totalCalDeleted += item.calories;
            totalProDeleted += item.protein;
            deletedDescriptions.push(item.description);
            
            await prisma.activityLog.create({
                data: {
                    action: 'FOOD_DELETED',
                    details: JSON.stringify({ source: sourceLogName, id: item.id })
                }
            });
        }

        await prisma.dailyLog.update({
            where: { id: log.id },
            data: {
                totalCalories: { decrement: totalCalDeleted },
                totalProtein: { decrement: totalProDeleted }
            }
        });

        return `🗑️ Deleted: ${deletedDescriptions.join(', ')} (-${totalCalDeleted} kcal)`;

    } else if (intent === 'EDIT_FOOD') {
        const log = await prisma.dailyLog.findUnique({
            where: { date: today },
            include: { foodLogs: { orderBy: { time: 'asc' } } }
        });

        if (!log || log.foodLogs.length === 0) {
            return 'You haven\'t logged anything today to edit.';
        }

        const editMatches = lowerText.match(/#\d+/g);
        if (!editMatches) {
            return 'Please specify which item to edit, e.g. "edit #1 to 300cal 20g".\nUse "show my logs" to see numbered items.';
        }

        let toEditItems = [];
        for (const match of editMatches) {
            const idx = parseInt(match.substring(1)) - 1;
            if (idx >= 0 && idx < log.foodLogs.length) {
                toEditItems.push(log.foodLogs[idx]);
            }
        }
        
        toEditItems = [...new Set(toEditItems)];

        if (toEditItems.length === 0) {
            return `Item(s) not found. You have ${log.foodLogs.length} items logged.`;
        }

        const calMatch = lowerText.match(/(\d+)\s*(?:cal|kcal|calories)/);
        const proMatch = lowerText.match(/(\d+)\s*(?:g|gram|protein)/);

        let totalCalDiff = 0;
        let totalProDiff = 0;
        let editDescriptions = [];

        for (const toEdit of toEditItems) {
            const newCal = calMatch ? parseInt(calMatch[1]) : toEdit.calories;
            const newPro = proMatch ? parseInt(proMatch[1]) : toEdit.protein;

            totalCalDiff += newCal - toEdit.calories;
            totalProDiff += newPro - toEdit.protein;
            
            await prisma.foodLog.update({
                where: { id: toEdit.id },
                data: { calories: newCal, protein: newPro }
            });

            await prisma.activityLog.create({
                data: {
                    action: 'FOOD_EDITED',
                    details: JSON.stringify({ source: sourceLogName, id: toEdit.id })
                }
            });
            
            editDescriptions.push(`*#${log.foodLogs.indexOf(toEdit) + 1}* ${toEdit.description} (${toEdit.calories} → ${newCal} kcal)`);
        }

        await prisma.dailyLog.update({
            where: { id: log.id },
            data: {
                totalCalories: { increment: totalCalDiff },
                totalProtein: { increment: totalProDiff }
            }
        });

        return `✏️ Updated:\n${editDescriptions.join('\n')}`;

    } else if (intent === 'GET_WEEKLY') {
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }

        const logs = await prisma.dailyLog.findMany({
            where: { date: { in: dates } },
            orderBy: { date: 'asc' }
        });

        const logMap = {};
        for (const l of logs) logMap[l.date] = l;

        let totalCal = 0, totalPro = 0, daysLogged = 0;
        let reply = `📅 *Weekly Summary (Last 7 Days)*\n\n`;

        for (const date of dates) {
            const l = logMap[date];
            const dayName = new Date(date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
            if (l) {
                reply += `${dayName}: ${l.totalCalories} kcal / ${l.totalProtein}g pro\n`;
                totalCal += l.totalCalories;
                totalPro += l.totalProtein;
                daysLogged++;
            } else {
                reply += `${dayName}: — no data\n`;
            }
        }

        const avgCal = daysLogged > 0 ? Math.round(totalCal / daysLogged) : 0;
        const avgPro = daysLogged > 0 ? Math.round(totalPro / daysLogged) : 0;

        reply += `\n📊 *Averages:* ${avgCal} kcal / ${avgPro}g protein per day`;
        reply += `\n🔥 *Total:* ${totalCal} kcal / ${totalPro}g protein`;
        return reply;

    } else if (intent === 'UNSUPPORTED') {
        return `🤔 Sorry, I can't help with that request.\n\nI'm a *fitness & nutrition bot* — here's what I can do:\n\n🍎 *Log Food* — "I ate 2 eggs and toast"\n📊 *Check Stats* — "How many calories today?"\n📅 *Weekly Progress* — "Weekly progress"\n📋 *View Logs* — "What did I eat today?"\n✏️ *Edit Log* — "Edit #1 to 300cal 20g"\n🗑️ *Delete Log* — "Delete #2"\n💪 *Today's Plan* — "What's my workout today?"\n\nType *help* for more details!`;
    } else {
        return `🤖 *AI Fitness Tracker*\n\nHere's what you can say:\n\n🍎 *Log Food*\n• "I ate 2 eggs and toast"\n\n📊 *Check Progress*\n• "How many calories today?"\n• "How many left?" / "Target"\n• "Weekly progress"\n\n📋 *View Logs*\n• "What did I eat today?"\n\n✏️ *Edit Log*\n• "Edit #1 to 300cal 20g"\n\n🗑️ *Delete Log*\n• "Delete #2"\n\n💪 *Today's Plan*\n• "What's my workout today?"`;
    }
}

module.exports = { handleMessageIntent };
