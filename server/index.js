require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startWhatsappbot } = require('./whatsapp');
const { startCron } = require('./cron');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


app.use('/api', routes);


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startTelegramBot } = require('./telegram');

prisma.appConfig.findUnique({ where: { key: 'bot_platform' } }).then(config => {
    const platform = config?.value || 'whatsapp';
    if (platform === 'whatsapp') {
        startWhatsappbot();
    } else if (platform === 'telegram') {
        startTelegramBot();
    }
});


startCron();

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
