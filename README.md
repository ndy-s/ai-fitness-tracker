# AI Fitness Tracker
<p>
  <blockquote style="display: inline; font-size: 1.2em; margin: 0;">
    "A full-stack, dynamic training and nutrition planner."
  </blockquote>
</p>

## About This Project

This project started as a way to seamlessly track daily meals and motivate myself with engaging reminders, while having a built-in intelligent WhatsApp AI agent right at my fingertips. 

What began as a simple tracker grew into a multi-provider fallback system with a smart agentic web UI. It's designed to act as your own personal coach that you can talk to naturally, the same way you would with a human.

### The Core Idea

The idea behind this project is very simple. I wanted an AI companion that tracks nutrition, manages schedules, and provides insightful summaries without needing to navigate complex menus.

You can simply send a message on WhatsApp or Telegram like:
> "I ate 2 eggs and a slice of bread"
> "completed 2x10 push-ups today"

The bot will automatically estimate the calories and protein or intelligently link your logged workout directly to your daily planned routine. It will even calculate your remaining macros! You can also send commands like `help`, `show my logs`, or `weekly progress` and it will instantly pull up the requested data. And if you make a mistake? Just say "edit #1 to 300cal 20g". It handles it seamlessly.

### Why It Works So Well?

It uses a Multi-Provider AI Fallback system integrating Google Gemini 2.5 Flash and DeepSeek V4 Flash (via OpenRouter). This automatic round-robin fallback handles rate limits (HTTP 429) and high-demand 503 errors gracefully.

The web UI provides a glassmorphism Light Theme dashboard built in React. You can view your 30-day history with dual-axis line charts and even chat with a global floating AI Agent to adjust your weekly workout or meal plans. And all of it runs locally, directly from your laptop.

**Intelligent Check-ins**: The system features a background cron job that monitors your meal schedules. It uses a sliding 15-minute window to check if you've logged any food around your planned meal times. If you haven't, it triggers a Humane AI check-in, where the AI proactively messages you like a supportive coach, suggesting quick alternatives to hit your macros if you're too busy to cook!

## Quick Setup

Getting the system up and running is straightforward. I've set it up so you can launch both the frontend and backend with a single script.

### 1. Clone Repository & Install Dependencies

First, clone the repository, set up your database, and install all dependencies:

```bash
git clone https://github.com/your-username/ai-fitness-tracker.git
cd ai-fitness-tracker
npm install
cd frontend
npm install
cd ..
```

### 2. Setup the Database (Prisma + SQLite)

Initialize the database using Prisma:
```bash
npx prisma init --datasource-provider sqlite
```
This creates a `prisma/schema.prisma` file and a `.env` file. The `.env` file requires the database URL and the backend server port:
```env
DATABASE_URL="file:./dev.db"
PORT=3000
```

> [!IMPORTANT]
> The server requires the `PORT` environment variable to be explicitly defined in your `.env`. If `PORT` is missing, the backend will throw an error and fail to start.
>
> AI model API keys (Gemini, OpenRouter) are configured directly from the **Settings & Management** page in the web UI. For security, these keys are automatically masked (e.g. `AIzaSy••••••••xxxx`) in API payloads and include a premium show/hide visibility toggle in the interface.

Then generate and push the schema:
```bash
npx prisma db push
npx prisma generate
```

### 3. Start the Server

Since this is designed to run locally on your laptop, there are no complex pipelines required. You can launch both the Node.js backend and the React Vite frontend simultaneously with one command:

```bash
npm run dev
```

This command will automatically launch the server and the UI. Open your browser and visit:
```
http://localhost:5173
```

> [!TIP]
> The backend runs on port `3000` and the frontend runs on port `5173`. They start together thanks to the `concurrently` script I added in the `package.json`.

### 4. Linking WhatsApp / Telegram

You can link either WhatsApp or Telegram to act as your AI coach interface:

**WhatsApp**:
1. Open the frontend and navigate to the **Settings & Management** tab.
2. Open WhatsApp on your secondary phone and scan the QR code displayed on the screen.
3. Once connected, use your **primary phone** to send a message to the bot (e.g., "Hello").
4. The bot will automatically register the first number that messages it as the "owner" and ignore all other numbers.

**Telegram**:
1. Create a new bot via BotFather on Telegram and get the bot token.
2. Paste the token into the **Settings & Management** page in the Web UI and select Telegram as your Active Platform.
3. Send a message to your new bot. It will securely register your Telegram ID as the owner.

You can now chat with the bot to log food, log your daily workouts, ask for weekly progress, edit logs, or use the Web AI Agent to modify your training plans!

## Under the Hood (Tech Stack)

* **Frontend**: React 19 (Vite) + Vanilla CSS (Glassmorphism) + Recharts + Lucide Icons
* **Backend**: Node.js + Express
* **Database**: SQLite + Prisma ORM
* **Bot**: `@whiskeysockets/baileys` (WhatsApp), `node-telegram-bot-api` (Telegram)
* **AI Integration**: Google GenAI SDK / OpenRouter API (`axios`)
* **Scheduler**: `node-cron`
