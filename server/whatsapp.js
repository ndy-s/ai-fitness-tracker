const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const { estimateCalories } = require('./ai');

const prisma = new PrismaClient();
let sock = null;
let currentQR = null;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = await qrcode.toDataURL(qr);
        }

        if (connection === 'close') {
            currentQR = null;
            const statusCode = (lastDisconnect.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440; // 440 is connectionReplaced
            
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            if (shouldReconnect) {
                // Add a small delay to prevent rapid reconnect loops
                setTimeout(startBot, 3000);
            } else if (statusCode === 440) {
                console.log('Connection conflict (440). Another session is open. Automatically disconnecting...');
                disconnectBot(true);
            } else {
                // Logged out (401)
                console.log('Auto-disconnecting to clear stale session...');
                disconnectBot(true);
            }
        } else if (connection === 'open') {
            currentQR = null;
            console.log('WhatsApp Bot is connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        
        if (msg.key.fromMe && msg.message) {
            console.log("--- DEBUG: Received a 'fromMe' message ---");
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            console.log(`Text: ${text}`);
            console.log("------------------------------------------");
        }

        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const sender = msg.key.remoteJid;

        // Skip group messages and status broadcasts
        if (sender.endsWith('@g.us') || sender === 'status@broadcast') return;

        if (sender.endsWith('@lid')) {
            console.log("--- DEBUG: RECEIVED @lid MESSAGE ---");
            console.log(JSON.stringify(msg, null, 2));
            console.log("------------------------------------");
        }

        try {
            const { processIncomingMessage } = require('./messageProcessor');
            
            if (sock && sock.user) {
                await sock.sendPresenceUpdate('composing', sender);
            }

            const sendReplyFn = async (replyText) => {
                if (sock && sock.user) {
                    await sock.sendPresenceUpdate('paused', sender);
                    await sock.sendMessage(sender, { text: replyText });
                }
            };

            await processIncomingMessage('whatsapp', { jid: sender, altJid: msg.key.remoteJidAlt }, text, sendReplyFn);
        } catch (error) {
            console.error('Bot processing error:', error);
            if (sock && sock.user) {
                await sock.sendPresenceUpdate('paused', sender);
                await sock.sendMessage(sender, { text: `Sorry, I ran into an error processing that request. Please try again.` });
            }
        }
    });
}

function getQR() {
    return currentQR;
}

function getStatus() {
    return sock && sock.user ? 'connected' : 'disconnected';
}

async function sendMessage(jid, text) {
    if (sock && sock.user) {
        await sock.sendMessage(jid, { text });
    }
}

async function disconnectBot(force = false) {
    if (sock) {
        try {
            sock.ev.removeAllListeners();
            if (force) {
                await sock.logout();
            } else {
                sock.end();
            }
        } catch (e) {
            console.error('Error during logout:', e);
        }
        sock = null;
        currentQR = null;
    }

    if (force) {
        const fs = require('fs');
        if (fs.existsSync('baileys_auth_info')) {
            fs.rmSync('baileys_auth_info', { recursive: true, force: true });
        }
        // Re-initialize to generate a new QR code
        startBot();
    }
}

module.exports = { 
    startWhatsappbot: startBot, 
    getWhatsappQR: getQR, 
    getWhatsappStatus: getStatus, 
    sendWhatsappMessage: sendMessage, 
    disconnectWhatsappbot: disconnectBot 
};
