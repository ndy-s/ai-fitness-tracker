const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({});

const defaultMeal = {
    target: {
        calories: "2650 kcal",
        protein: "145g",
        carbs: "320g",
        fats: "70g"
    },
    schedule: [
        { time:"07:00", title:"Breakfast", kcal:"~550 kcal", items:["Eggs","Bread","Milk","Banana"], protein:"35g" },
        { time:"10:00", title:"Snack", kcal:"~300 kcal", items:["Yogurt","Nuts","Apple"], protein:"20g" },
        { time:"13:00", title:"Lunch", kcal:"~700 kcal", items:["Rice","Chicken","Tempeh","Vegetables"], protein:"45g" },
        { time:"16:00", title:"Pre-Workout", kcal:"~350 kcal", items:["Bread","Peanut butter","Banana"], protein:"18g" },
        { time:"19:30", title:"Dinner", kcal:"~650 kcal", items:["Rice","Fish","Eggs","Vegetables"], protein:"42g" },
        { time:"21:30", title:"Night Snack", kcal:"~250 kcal", items:["Milk","Eggs or tofu"], protein:"20g" }
    ]
};

const data = [
    {
        dayOfWeek: "monday",
        title: "Monday",
        workouts: [
            { name: "Knee Push-ups / Standard Push-ups", reps: "3 × 8–12", video: "https://www.youtube.com/watch?v=IODxDxX7oi4" },
            { name: "Plank Shoulder Taps", reps: "3 × 12–16 taps", video: "https://www.youtube.com/watch?v=gZHGk0B2n20" }
        ],
        meal: defaultMeal
    },
    {
        dayOfWeek: "tuesday",
        title: "Tuesday",
        workouts: [
            { name: "Superman Hold", reps: "3 × 20–30 sec", video: "https://www.youtube.com/watch?v=z6PJMT2y8GQ" },
            { name: "Reverse Snow Angels", reps: "3 × 10–12", video: "https://www.youtube.com/watch?v=l_8rKIPkpx0" }
        ],
        meal: defaultMeal
    },
    {
        dayOfWeek: "wednesday",
        title: "Wednesday",
        workouts: [
            { name: "Bodyweight Squats", reps: "3 × 10–15", video: "https://www.youtube.com/watch?v=gcNh17Ckjgg" },
            { name: "Glute Bridges", reps: "3 × 12–15", video: "https://www.youtube.com/watch?v=wPM8co452AA" },
            { name: "Calf Raises", reps: "3 × 15–20", video: "https://www.youtube.com/watch?v=-M4-G8p8fmc" }
        ],
        meal: defaultMeal
    },
    {
        dayOfWeek: "thursday",
        title: "Thursday",
        isRestDay: true,
        workouts: [],
        meal: defaultMeal
    },
    {
        dayOfWeek: "friday",
        title: "Friday",
        workouts: [
            { name: "Knee Push-ups", reps: "3 × 8–12", video: "https://www.youtube.com/watch?v=WcHtt6zT3Go" },
            { name: "Plank Hold", reps: "3 × 30–45 sec", video: "https://www.youtube.com/watch?v=pSHjTRCQxIw" }
        ],
        meal: defaultMeal
    },
    {
        dayOfWeek: "saturday",
        title: "Saturday",
        workouts: [
            { name: "Brisk Walk / Active Recovery", reps: "15–20 min", video: "https://www.youtube.com/watch?v=kR6ZExOTB-U" },
            { name: "Bicycle Crunches", reps: "3 × 12–16", video: "https://www.youtube.com/watch?v=Iwyvozckjak" }
        ],
        meal: defaultMeal
    },
    {
        dayOfWeek: "sunday",
        title: "Sunday",
        isRestDay: true,
        workouts: [],
        meal: defaultMeal
    }
];

async function main() {
    console.log("Seeding database...");
    await prisma.plan.deleteMany({}); // clear existing
    
    for (const d of data) {
        await prisma.plan.create({
            data: {
                dayOfWeek: d.dayOfWeek,
                title: d.title,
                isRestDay: d.isRestDay || false,
                workouts: {
                    create: d.workouts
                },
                mealTarget: {
                    create: {
                        calories: d.meal.target.calories,
                        protein: d.meal.target.protein,
                        carbs: d.meal.target.carbs,
                        fats: d.meal.target.fats
                    }
                },
                mealSchedules: {
                    create: d.meal.schedule.map(m => ({
                        time: m.time,
                        title: m.title,
                        kcal: m.kcal,
                        items: JSON.stringify(m.items),
                        protein: m.protein
                    }))
                }
            }
        });
    }

    // Default Config
    await prisma.appConfig.upsert({
        where: { key: 'ai_provider' },
        update: {},
        create: { key: 'ai_provider', value: 'gemini' }
    });

    console.log("Seeding finished.");
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
