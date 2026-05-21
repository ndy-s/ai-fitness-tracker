const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getProviders() {
    const config = await prisma.appConfig.findUnique({ where: { key: 'ai_providers' } });
    let providers = [];
    if (config && config.value) {
        try {
            providers = JSON.parse(config.value);
        } catch {
            providers = [config.value];
        }
    } else {
        // Fallback: check old single provider key
        const legacy = await prisma.appConfig.findUnique({ where: { key: 'ai_provider' } });
        if (legacy && legacy.value) providers = [legacy.value];
        else providers = ['gemini'];
    }

    const geminiKey = await prisma.appConfig.findUnique({ where: { key: 'gemini_api_key' } });
    const openrouterKey = await prisma.appConfig.findUnique({ where: { key: 'openrouter_api_key' } });

    const activeProviders = [];
    if (providers.includes('gemini') && geminiKey && geminiKey.value) activeProviders.push('gemini');
    if (providers.includes('deepseek') && openrouterKey && openrouterKey.value) activeProviders.push('deepseek');
    
    return activeProviders;
}

async function callGemini(prompt) {
    const geminiKey = await prisma.appConfig.findUnique({ where: { key: 'gemini_api_key' } });
    if (!geminiKey || !geminiKey.value) {
        throw new Error('GEMINI_API_KEY is not set in configuration');
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey.value });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    let resultText = response.text;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    return resultText;
}

async function callDeepSeek(prompt) {
    const openrouterKey = await prisma.appConfig.findUnique({ where: { key: 'openrouter_api_key' } });
    if (!openrouterKey || !openrouterKey.value) {
        throw new Error('OPENROUTER_API_KEY is not set in configuration');
    }
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'deepseek/deepseek-v4-flash:free',
        messages: [{ role: 'user', content: prompt }]
    }, {
        headers: {
            'Authorization': `Bearer ${openrouterKey.value}`,
            'Content-Type': 'application/json',
            'X-OpenRouter-Title': 'AI Fitness Tracker'
        }
    });

    // Safety: check for valid response structure
    if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Unexpected OpenRouter response:', JSON.stringify(response.data));
        throw new Error('OpenRouter returned an empty or malformed response');
    }

    let resultText = response.data.choices[0].message.content;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    // DeepSeek sometimes puts <think> blocks in the response. We should remove them.
    resultText = resultText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return resultText;
}

const PROVIDER_MAP = {
    gemini: callGemini,
    deepseek: callDeepSeek,
};

async function callWithRoundRobin(prompt) {
    const providers = await getProviders();
    let lastError = null;
    
    if (providers.length === 0) {
        throw new Error('No AI providers configured or missing API keys.');
    }

    for (const provider of providers) {
        const fn = PROVIDER_MAP[provider];
        if (!fn) {
            console.warn(`Unknown AI provider: ${provider}, skipping.`);
            continue;
        }
        // Try up to 2 times per provider (retry once on 429)
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                console.log(`Trying AI provider: ${provider} (attempt ${attempt + 1})`);
                return await fn(prompt);
            } catch (err) {
                console.error(`Provider ${provider} failed:`, err.message);
                lastError = err;
                // If rate limited, wait 5 seconds then retry same provider
                if (err.response?.status === 429 && attempt === 0) {
                    console.log(`Rate limited by ${provider}, waiting 5s before retry...`);
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }
                break; // non-429 error or second attempt, move to next provider
            }
        }
    }

    throw lastError || new Error('No AI providers configured.');
}

async function callGeminiChat(messages) {
    const geminiKey = await prisma.appConfig.findUnique({ where: { key: 'gemini_api_key' } });
    if (!geminiKey || !geminiKey.value) {
        throw new Error('GEMINI_API_KEY is not set in configuration');
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey.value });
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
    }));
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
    });
    return response.text;
}

async function callDeepSeekChat(messages) {
    const openrouterKey = await prisma.appConfig.findUnique({ where: { key: 'openrouter_api_key' } });
    if (!openrouterKey || !openrouterKey.value) {
        throw new Error('OPENROUTER_API_KEY is not set in configuration');
    }
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'deepseek/deepseek-v4-flash:free',
        messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content }))
    }, {
        headers: {
            'Authorization': `Bearer ${openrouterKey.value}`,
            'Content-Type': 'application/json',
            'X-OpenRouter-Title': 'AI Fitness Tracker'
        }
    });

    // Safety: check for valid response structure
    if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Unexpected OpenRouter chat response:', JSON.stringify(response.data));
        throw new Error('OpenRouter returned an empty or malformed response');
    }

    let resultText = response.data.choices[0].message.content;
    resultText = resultText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return resultText;
}

const CHAT_PROVIDER_MAP = {
    gemini: callGeminiChat,
    deepseek: callDeepSeekChat,
};

async function callChatWithRoundRobin(messages) {
    const providers = await getProviders();
    let lastError = null;

    if (providers.length === 0) {
        throw new Error('No AI providers configured or missing API keys.');
    }

    for (const provider of providers) {
        const fn = CHAT_PROVIDER_MAP[provider];
        if (!fn) continue;
        try {
            console.log(`Trying chat provider: ${provider}`);
            return await fn(messages);
        } catch (err) {
            console.error(`Chat provider ${provider} failed:`, err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('No AI providers configured.');
}

async function classifyBotIntent(text) {
    const prompt = `
You are a fitness bot AI assistant routing a user's WhatsApp message.

Analyze the user's message: "${text}"

Classify it into EXACTLY ONE of the following intents:
- LOG_FOOD: The user is reporting food they ate (e.g. "log a banana", "I ate 2 eggs and toast", "log 4 slices white bread"). The message MUST describe actual food or drinks.
- LOG_WORKOUT: The user is reporting a workout they completed (e.g. "log 2x10 push-ups", "did standard push-ups 3x8", "log push up 2x10 today").
- GET_STATS: The user wants to know their daily progress, calories, or macros (e.g. "how many calories today?", "show my stats").
- GET_PLAN: The user is asking about their workout or meal plan for today (e.g. "what is today's plan?", "what workout today?").
- GET_LOGS: The user wants to see a list of all foods and workouts they logged today (e.g. "what did I eat today?", "show my logs").
- DELETE_FOOD: The user wants to delete or remove a wrongly logged food (e.g. "delete the banana", "I didn't eat the burger remove it").
- DELETE_WORKOUT: The user wants to delete or remove a wrongly logged workout (e.g. "remove sit up", "delete my push ups log").
- EDIT_FOOD: The user wants to edit or update a previously logged food entry (e.g. "edit #1 to 300cal", "update #2 to 500 calories 30g protein").
- GET_WEEKLY: The user wants to see their weekly summary or progress (e.g. "weekly progress", "how was my week?").
- HELP: The user is asking what the bot can do or asking for help (e.g. "help", "what can you do?").
- UNSUPPORTED: The message does NOT relate to any fitness or nutrition feature listed above (e.g. greetings like "hello", questions about weather, random conversation, or any request outside of food/workout logging, stats, plans, and logs).

IMPORTANT: Only classify as LOG_FOOD if the message clearly describes food or drink items. Only classify as LOG_WORKOUT if the message clearly describes exercises or physical activity. General greetings, questions, chit-chat, or unrelated requests must be classified as UNSUPPORTED.

Reply ONLY with a valid JSON object in this exact format, with no markdown formatting or backticks:
{
  "intent": "<ONE OF THE INTENTS ABOVE>",
  "target": "<If intent is DELETE_FOOD, the name of the food to delete, else empty string>",
  "targetWorkout": "<If intent is DELETE_WORKOUT, the name of the workout to delete, else empty string>",
  "workoutName": "<If intent is LOG_WORKOUT, the name of the exercise/workout, else empty string>",
  "reps": "<If intent is LOG_WORKOUT, the reps/sets or duration completed e.g. '2x10' or '30 min', else empty string>"
}
`;
    const resultText = await callWithRoundRobin(prompt);
    return JSON.parse(resultText);
}

async function generateEngagingReminder(baseMsg, type) {
    const prompt = `
You are a highly motivating, energetic, and supportive AI fitness coach.
I have an automated reminder message of type "${type}".

Base Message:
"""
${baseMsg}
"""

Rewrite this message to sound like a quick, casual text message from a friend checking in. Keep all the factual details (times, items, reps, targets) from the base message exactly intact, but make it very natural and grounded.
CRITICAL RULE: DO NOT USE ANY EMOJIS AT ALL. Keep it very short, casual, and text-message like. Sound like a real human, do not sound like a coach or AI.

Return ONLY the rewritten message, no quotes, no markdown blocks.
`;
    try {
        return await callWithRoundRobin(prompt);
    } catch (err) {
        console.error("Failed to generate engaging reminder, falling back to base:", err);
        return baseMsg; // fallback
    }
}

async function estimateCalories(text) {
    const prompt = `
You are a fitness and nutrition AI. The user has eaten the following:
"${text}"

Estimate the nutritional value. Reply ONLY with a valid JSON object in this exact format, with no markdown formatting or backticks:
{
  "calories": <total estimated kcal as integer>,
  "protein": <total estimated protein in grams as integer>,
  "carbs": <total estimated carbs in grams as integer>,
  "fats": <total estimated fats in grams as integer>,
  "description": "<short summarized description of the food>"
}`;

    const resultText = await callWithRoundRobin(prompt);
    return JSON.parse(resultText);
}

async function generateHumaneReminder(meal) {
    let itemsList = 'planned items';
    try {
        const parsed = JSON.parse(meal.items);
        if (Array.isArray(parsed) && parsed.length > 0) {
            itemsList = parsed.join(', ');
        }
    } catch (e) {}

    const baseMsg = `Gentle check-in! Did you get a chance to have your ${meal.title}? Target: ${meal.kcal} kcal, ${meal.protein}g protein. Planned: ${itemsList}.`;

    const prompt = `
You are a warm, supportive, and empathetic personal health assistant. You are checking in on the user because they missed logging a scheduled meal in their fitness plan.

Here is the meal they missed:
- Meal Title: "${meal.title}"
- Scheduled Time: ${meal.time}
- Target Calories: ${meal.kcal} kcal
- Target Protein: ${meal.protein}
- Planned Items: ${itemsList}

Write a quick, casual text message to check if they ate it.
Guidelines:
1. Sound like a real human texting a friend. Be extremely casual. Do NOT sound like a robot, AI, or a formal coach. 
2. Suggest a quick, realistic tip or simple food alternative to help them meet the calorie (${meal.kcal} kcal) and protein (${meal.protein}) target if they missed it.
3. Keep it brief and easy to read (max 2-3 sentences), exactly like a real text message. DO NOT USE ANY EMOJIS AT ALL.
4. Return ONLY the message text, with no extra commentary, quotes, or markdown wrappers.
`;
    try {
        return await callWithRoundRobin(prompt);
    } catch (err) {
        console.error("Failed to generate humane reminder, falling back to base message:", err);
        return baseMsg;
    }
}

module.exports = { estimateCalories, getProviders, callChatWithRoundRobin, classifyBotIntent, generateEngagingReminder, generateHumaneReminder };
