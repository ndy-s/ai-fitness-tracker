const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ai = new GoogleGenAI({});

async function getProviders() {
    const config = await prisma.appConfig.findUnique({ where: { key: 'ai_providers' } });
    if (config && config.value) {
        try {
            return JSON.parse(config.value);
        } catch {
            return [config.value];
        }
    }
    // Fallback: check old single provider key
    const legacy = await prisma.appConfig.findUnique({ where: { key: 'ai_provider' } });
    if (legacy && legacy.value) return [legacy.value];
    return ['gemini'];
}

async function callGemini(prompt) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    let resultText = response.text;
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    return resultText;
}

async function callDeepSeek(prompt) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set');
    }
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'deepseek/deepseek-v4-flash:free',
        messages: [{ role: 'user', content: prompt }]
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }
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
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY missing');
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'deepseek/deepseek-v4-flash:free',
        messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content }))
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
- LOG_FOOD: The user is reporting food they ate (e.g. "I ate a banana", "2 eggs and toast", "nasi goreng 1 porsi"). The message MUST describe actual food or drinks.
- GET_STATS: The user wants to know their daily progress, calories, or macros (e.g. "how many calories today?", "show my stats").
- GET_PLAN: The user is asking about their workout or meal plan for today (e.g. "what is today's plan?", "what workout today?").
- GET_LOGS: The user wants to see a list of all foods they logged today (e.g. "what did I eat today?", "show my logs").
- DELETE_FOOD: The user wants to delete or remove a wrongly logged food (e.g. "delete the banana", "I didn't eat the burger remove it").
- EDIT_FOOD: The user wants to edit or update a previously logged food entry (e.g. "edit #1 to 300cal", "update #2 to 500 calories 30g protein").
- GET_WEEKLY: The user wants to see their weekly summary or progress (e.g. "weekly progress", "how was my week?").
- HELP: The user is asking what the bot can do or asking for help (e.g. "help", "what can you do?").
- UNSUPPORTED: The message does NOT relate to any fitness or nutrition feature listed above (e.g. greetings like "hello", questions about weather, random conversation, or any request outside of food logging, stats, plans, and logs).

IMPORTANT: Only classify as LOG_FOOD if the message clearly describes food or drink items. General greetings, questions, chit-chat, or unrelated requests must be classified as UNSUPPORTED.

Reply ONLY with a valid JSON object in this exact format, with no markdown formatting or backticks:
{
  "intent": "<ONE OF THE INTENTS ABOVE>",
  "target": "<If intent is DELETE_FOOD, the name of the food to delete, else empty string>"
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

Rewrite this message to be engaging, friendly, and unique. Keep all the factual details (times, items, reps, targets) from the base message exactly intact, but wrap them in an encouraging tone with some emojis. Do not make the message overly long (keep it concise for WhatsApp). 

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

module.exports = { estimateCalories, getProviders, callChatWithRoundRobin, classifyBotIntent, generateEngagingReminder };
