const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleMessageIntent } = require('./intentHandler');

async function checkOwnership(platform, senderInfo, sendReplyFn) {
    if (platform === 'whatsapp') {
        const senderId = typeof senderInfo === 'object' ? senderInfo.jid : senderInfo;
        const senderAltId = typeof senderInfo === 'object' ? senderInfo.altJid : null;

        let ownerConfig = await prisma.appConfig.findUnique({ where: { key: 'owner_jid' } });
        
        if (!ownerConfig || !ownerConfig.value) {
            console.log(`Ignored message from ${senderId}: No owner configured in UI.`);
            return false;
        }

        // Extract just the numeric part for comparison (handles both @s.whatsapp.net and @lid formats)
        const getNumeric = (jid) => jid ? jid.replace(/@.*$/, '') : null;
        const ownerNumeric = getNumeric(ownerConfig.value);
        const senderNumeric = getNumeric(senderId);
        const senderAltNumeric = getNumeric(senderAltId);

        if (ownerNumeric === senderNumeric || (senderAltNumeric && ownerNumeric === senderAltNumeric)) {
            // Automatically update DB to the lid if they used phone number? Not needed, just return true.
            return true;
        }

        // Check secondary JID
        let secondaryConfig = await prisma.appConfig.findUnique({ where: { key: 'owner_jid_secondary' } });
        if (secondaryConfig && secondaryConfig.value) {
            const secondaryNumeric = getNumeric(secondaryConfig.value);
            if (secondaryNumeric === senderNumeric || (senderAltNumeric && secondaryNumeric === senderAltNumeric)) {
                return true;
            }
        }

        console.log('\n❌ UNAUTHORIZED MESSAGE RECEIVED ❌');
        console.log(`Someone tried to message the bot, but they are not whitelisted.`);
        console.log(`If this was you, please go to the Management UI and enter this EXACT ID in the WhatsApp Whitelist field:`);
        const displayId = senderAltNumeric || senderNumeric;
        console.log(`👉 ${displayId} 👈\n`);
        return false;
    } else if (platform === 'telegram') {
        const senderId = typeof senderInfo === 'object' ? senderInfo.jid : senderInfo;
        let ownerConfig = await prisma.appConfig.findUnique({ where: { key: 'owner_telegram_id' } });
        
        if (!ownerConfig || !ownerConfig.value) {
            console.log(`Ignored message from ${senderId}: No owner configured in UI.`);
            return false;
        } else if (ownerConfig.value !== senderId) {
            console.log(`Ignored message from unauthorized Telegram ID: ${senderId}`);
            return false;
        }
        return true;
    }
    return false;
}



/**
 * Main entry point for all incoming messages from any platform adapter.
 * @param {string} platform 'whatsapp' | 'telegram'
 * @param {string|object} senderInfo The ID of the sender to verify auth, or an object { jid, altJid }
 * @param {string} text The incoming message text
 * @param {function} sendReplyFn An async function that accepts a string to send back
 */
async function processIncomingMessage(platform, senderInfo, text, sendReplyFn) {
    try {
        const isAuthorized = await checkOwnership(platform, senderInfo, sendReplyFn);
        if (!isAuthorized) return;

        const reply = await handleMessageIntent(text, platform, sendReplyFn);
        if (reply) {
            await sendReplyFn(reply);
        }
    } catch (error) {
        console.error('Bot processing error:', error);
        await sendReplyFn(`Sorry, I ran into an error processing that request. Please try again.`);
    }
}

module.exports = { processIncomingMessage };
