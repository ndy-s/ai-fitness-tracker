const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendWhatsappMessage } = require('./whatsapp');
const { sendTelegramMessage } = require('./telegram');
const { generateEngagingReminder, generateHumaneReminder } = require('./ai');

const prisma = new PrismaClient();

async function dispatchMessage(msg, type, skipRewrite = false) {
    try {
        const platformConfig = await prisma.appConfig.findUnique({ where: { key: 'bot_platform' } });
        const platform = platformConfig?.value || 'whatsapp';
        const finalMsg = skipRewrite ? msg : await generateEngagingReminder(msg, type);

        if (platform === 'whatsapp') {
            const config = await prisma.appConfig.findUnique({ where: { key: 'owner_jid' } });
            if (config && config.value) {
                await sendWhatsappMessage(config.value, finalMsg);
            }
        } else if (platform === 'telegram') {
            const config = await prisma.appConfig.findUnique({ where: { key: 'owner_telegram_id' } });
            if (config && config.value) {
                await sendTelegramMessage(config.value, finalMsg);
            }
        }

        await prisma.activityLog.create({
            data: {
                action: 'REMINDER_SENT',
                details: JSON.stringify({ source: 'cron_scheduler', type, platform })
            }
        });
    } catch (e) {
        console.error('Error dispatching message:', e);
    }
}

async function startCron() {

    cron.schedule('0 * * * *', async () => {
        try {
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayStr = days[now.getDay()];

            const plan = await prisma.plan.findUnique({
                where: { dayOfWeek: todayStr },
                include: { mealSchedules: true }
            });

            if (!plan) return;

            const currentHour = now.getHours().toString().padStart(2, '0');

            for (const meal of plan.mealSchedules) {

                const mealHour = meal.time.split(':')[0];
                if (mealHour === currentHour) {
                    const msg = `Reminder to eat: ${meal.title}\nTime: ${meal.time}\nTarget: ${meal.kcal}\nItems: ${JSON.parse(meal.items).join(', ')}`;
                    await dispatchMessage(msg, 'meal');
                }
            }
        } catch (err) {
            console.error('Cron error:', err);
        }
    });


    cron.schedule('0 8 * * *', async () => {
        try {
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayStr = days[now.getDay()];

            const plan = await prisma.plan.findUnique({
                where: { dayOfWeek: todayStr },
                include: { workouts: true }
            });

            if (!plan) return;

            if (plan.isRestDay) {
                await dispatchMessage(`Today is a Rest Day! Take it easy.`, 'rest');
            } else {
                let msg = `Today's Workout Plan (${plan.title}):\n`;
                for (const w of plan.workouts) {
                    msg += `- ${w.name}: ${w.reps}\n`;
                }
                await dispatchMessage(msg, 'workout');
            }
        } catch (err) {
            console.error('Cron error:', err);
        }
    });

    // Gentle check-in: Runs every 15 minutes to check if meals scheduled ~45 mins ago have been logged
    cron.schedule('*/15 * * * *', async () => {
        try {
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayStr = days[now.getDay()];

            const plan = await prisma.plan.findUnique({
                where: { dayOfWeek: todayStr },
                include: { mealSchedules: true }
            });

            if (!plan) return;

            const todayDateStr = now.toISOString().split('T')[0];

            for (const meal of plan.mealSchedules) {
                const mealDate = getMealDateTime(now, meal.time);
                if (!mealDate) continue;

                // Difference in minutes since meal was scheduled
                const diffMinutes = (now - mealDate) / 60000;

                // Select meal if scheduled between 35 and 50 minutes ago (~45 mins)
                if (diffMinutes >= 35 && diffMinutes < 50) {
                    const startWindow = new Date(mealDate.getTime() - 30 * 60000);

                    // Fetch today's daily log
                    const dailyLog = await prisma.dailyLog.findUnique({
                        where: { date: todayDateStr },
                        include: { foodLogs: true }
                    });

                    let hasLogged = false;
                    if (dailyLog && dailyLog.foodLogs) {
                        hasLogged = dailyLog.foodLogs.some(log => {
                            const logTime = new Date(log.time);
                            return logTime >= startWindow && logTime <= now;
                        });
                    }

                    if (!hasLogged) {
                        const msg = await generateHumaneReminder(meal);
                        await dispatchMessage(msg, 'meal_missed_humane', true);
                    }
                }
            }
        } catch (err) {
            console.error('Gentle check-in cron error:', err);
        }
    });
}

function getMealDateTime(dateObj, timeStr) {
    const match = timeStr.trim().match(/^(\d+):(\d+)(?:\s*(AM|PM))?$/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3];
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const d = new Date(dateObj);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

module.exports = { startCron };
