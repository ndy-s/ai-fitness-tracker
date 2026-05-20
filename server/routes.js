const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getWhatsappQR, getWhatsappStatus, disconnectWhatsappbot, startWhatsappbot } = require('./whatsapp');
const { getTelegramStatus, disconnectTelegramBot, startTelegramBot } = require('./telegram');

const router = express.Router();
const prisma = new PrismaClient();


router.get('/bot/status', (req, res) => {
    res.json({
        status: getWhatsappStatus(),
        qr: getWhatsappQR()
    });
});


router.post('/bot/disconnect', async (req, res) => {
    try {
        await disconnectWhatsappbot();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/bot/connect', async (req, res) => {
    try {
        await startWhatsappbot();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/bot/telegram/status', (req, res) => {
    res.json({
        status: getTelegramStatus()
    });
});


router.post('/bot/telegram/disconnect', async (req, res) => {
    try {
        await disconnectTelegramBot();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/bot/telegram/connect', async (req, res) => {
    try {
        await startTelegramBot();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/plans', async (req, res) => {
    try {
        const plans = await prisma.plan.findMany({
            include: { workouts: true, mealTarget: true, mealSchedules: true }
        });
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.put('/plans/:id', async (req, res) => {
    try {
        const { isRestDay } = req.body;
        const plan = await prisma.plan.update({
            where: { id: req.params.id },
            data: { isRestDay }
        });
        res.json(plan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/daily/:date', async (req, res) => {
    try {
        const log = await prisma.dailyLog.findUnique({
            where: { date: req.params.date },
            include: { foodLogs: true }
        });
        res.json(log || { totalCalories: 0, totalProtein: 0, foodLogs: [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const logs = await prisma.dailyLog.findMany({
            orderBy: { date: 'desc' },
            include: { foodLogs: true },
            take: days
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.delete('/daily/food/:id', async (req, res) => {
    try {
        const foodLog = await prisma.foodLog.findUnique({ where: { id: req.params.id } });
        if (!foodLog) {
            return res.status(404).json({ error: 'Food log not found' });
        }

        await prisma.foodLog.delete({ where: { id: req.params.id } });

        // Decrement daily log totals
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
                details: JSON.stringify({ source: 'web_ui', id: req.params.id })
            }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/config', async (req, res) => {
    try {
        const configs = await prisma.appConfig.findMany();
        const result = {};
        for (const c of configs) {
            result[c.key] = c.value;
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.put('/config', async (req, res) => {
    try {
        const { key, value } = req.body;
        const config = await prisma.appConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
        
        await prisma.activityLog.create({
            data: {
                action: 'CONFIG_UPDATED',
                details: JSON.stringify({ source: 'web_ui', key })
            }
        });
        
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.delete('/config/owner', async (req, res) => {
    try {
        const platform = req.query.platform || 'whatsapp';
        let keysToDelete = [];
        
        if (platform === 'whatsapp') {
            keysToDelete = ['owner_jid', 'owner_jid_secondary'];
        } else if (platform === 'telegram') {
            keysToDelete = ['owner_telegram_id'];
        }

        await prisma.appConfig.deleteMany({
            where: {
                key: { in: keysToDelete }
            }
        });
        
        await prisma.activityLog.create({
            data: {
                action: 'CONFIG_UPDATED',
                details: JSON.stringify({ source: 'web_ui', action: `unlink_owner_${platform}` })
            }
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/workouts', async (req, res) => {
    try {
        const { planId, name, reps, video } = req.body;
        const workout = await prisma.workout.create({
            data: { planId, name, reps, video }
        });
        
        await prisma.activityLog.create({
            data: {
                action: 'PLAN_UPDATED',
                details: JSON.stringify({ source: 'web_ui', action: 'add_workout', planId })
            }
        });
        
        res.json(workout);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.delete('/workouts/:id', async (req, res) => {
    try {
        await prisma.workout.delete({ where: { id: req.params.id } });
        
        await prisma.activityLog.create({
            data: {
                action: 'PLAN_UPDATED',
                details: JSON.stringify({ source: 'web_ui', action: 'delete_workout', id: req.params.id })
            }
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/meals', async (req, res) => {
    try {
        const { planId, time, title, items, kcal, protein, applyToAll } = req.body;
        
        if (applyToAll) {
            const allPlans = await prisma.plan.findMany();
            const mealPromises = allPlans.map(p => 
                prisma.mealSchedule.create({
                    data: { planId: p.id, time, title, items: JSON.stringify(items), kcal, protein }
                })
            );
            await Promise.all(mealPromises);
            res.json({ success: true, multiple: true });
        } else {
            const meal = await prisma.mealSchedule.create({
                data: { planId, time, title, items: JSON.stringify(items), kcal, protein }
            });
            res.json(meal);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.delete('/meals/:id', async (req, res) => {
    try {
        await prisma.mealSchedule.delete({ where: { id: req.params.id } });
        
        await prisma.activityLog.create({
            data: {
                action: 'PLAN_UPDATED',
                details: JSON.stringify({ source: 'web_ui', action: 'delete_meal', id: req.params.id })
            }
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/daily/food', async (req, res) => {
    try {
        const { date, description, calories, protein } = req.body;
        
        let dailyLog = await prisma.dailyLog.findUnique({ where: { date } });
        if (!dailyLog) {
            dailyLog = await prisma.dailyLog.create({ data: { date } });
        }

        const foodLog = await prisma.foodLog.create({
            data: {
                description,
                calories: parseInt(calories),
                protein: parseInt(protein),
                dailyLogId: dailyLog.id
            }
        });

        await prisma.dailyLog.update({
            where: { id: dailyLog.id },
            data: {
                totalCalories: { increment: parseInt(calories) },
                totalProtein: { increment: parseInt(protein) }
            }
        });

        await prisma.activityLog.create({
            data: {
                action: 'FOOD_LOGGED',
                details: JSON.stringify({ source: 'web_ui', description, calories })
            }
        });

        res.json(foodLog);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const { handleAgentChat } = require('./agent');


router.post('/agent/chat', async (req, res) => {
    try {
        const { messages, sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }
        const reply = await handleAgentChat(messages, sessionId);
        res.json({ reply });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


router.get('/agent/sessions', async (req, res) => {
    try {
        const sessions = await prisma.agentSession.findMany({
            orderBy: { timestamp: 'desc' }
        });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/agent/sessions', async (req, res) => {
    try {
        const session = await prisma.agentSession.create({
            data: { title: 'New Chat' }
        });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/agent/sessions/:id', async (req, res) => {
    try {
        await prisma.agentSession.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/agent/sessions/:id/messages', async (req, res) => {
    try {
        const history = await prisma.agentMessage.findMany({
            where: { sessionId: req.params.id },
            orderBy: { timestamp: 'asc' }
        });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get('/activity', async (req, res) => {
    try {
        const logs = await prisma.activityLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100 // limit to last 100 entries for UI performance
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
