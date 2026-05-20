const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const { estimateCalories } = require('./ai');

const prisma = new PrismaClient();
let bot = null;
let isConnected = false;

async function startTelegramBot() {
    const tokenConfig = await prisma.appConfig.findUnique({ where: { key: 'telegram_bot_token' } });
    if (!tokenConfig || !tokenConfig.value) {
        console.log('No Telegram bot token found. Telegram bot not started.');
        isConnected = false;
        return;
    }

    const token = tokenConfig.value;
    try {
        if (bot) {
            await bot.stopPolling();
            bot = null;
        }

        bot = new TelegramBot(token, { polling: true });
        isConnected = true;
        console.log('Telegram Bot is connected!');

        bot.on('polling_error', (error) => {
            console.error('Telegram Polling Error:', error);
            isConnected = false;
        });

        bot.on('message', async (msg) => {
            if (!msg.text) return;

            const text = msg.text;
            const senderId = msg.chat.id.toString();

            try {
                const { processIncomingMessage } = require('./messageProcessor');
                
                const sendReplyFn = async (replyText) => {
                    await bot.sendMessage(senderId, replyText, { parse_mode: 'Markdown' });
                };

                await processIncomingMessage('telegram', senderId, text, sendReplyFn);
            } catch (error) {
                console.error('Bot processing error:', error);
                await bot.sendMessage(senderId, `Sorry, I ran into an error processing that request. Please try again.`);
            }
        });
    } catch (err) {
        console.error('Failed to start Telegram Bot:', err);
        isConnected = false;
    }
}

function getTelegramStatus() {
    return isConnected ? 'connected' : 'disconnected';
}

async function sendTelegramMessage(chatId, text) {
    if (bot && isConnected) {
        await bot.sendMessage(chatId, text);
    }
}

async function disconnectTelegramBot() {
    if (bot) {
        try {
            await bot.stopPolling();
        } catch (e) {
            console.error('Error stopping Telegram bot:', e);
        }
    }
    bot = null;
    isConnected = false;
    // Clear the token from DB on manual disconnect
    await prisma.appConfig.deleteMany({
        where: { key: 'telegram_bot_token' }
    });
}

module.exports = { startTelegramBot, getTelegramStatus, sendTelegramMessage, disconnectTelegramBot };
