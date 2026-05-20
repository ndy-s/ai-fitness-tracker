const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendWhatsappMessage } = require('./whatsapp');
const { sendTelegramMessage } = require('./telegram');
const { generateEngagingReminder } = require('./ai');

const prisma = new PrismaClient();

async function dispatchMessage(msg, type) {
    try {
        const platformConfig = await prisma.appConfig.findUnique({ where: { key: 'bot_platform' } });
        const platform = platformConfig?.value || 'whatsapp';
        const engagingMsg = await generateEngagingReminder(msg, type);

        if (platform === 'whatsapp') {
            const config = await prisma.appConfig.findUnique({ where: { key: 'owner_jid' } });
            if (config && config.value) {
                await sendWhatsappMessage(config.value, engagingMsg);
            }
        } else if (platform === 'telegram') {
            const config = await prisma.appConfig.findUnique({ where: { key: 'owner_telegram_id' } });
            if (config && config.value) {
                await sendTelegramMessage(config.value, engagingMsg);
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

            if (!plan || plan.isRestDay) return;

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
}

module.exports = { startCron };
