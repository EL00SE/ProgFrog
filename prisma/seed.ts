import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { type Equipment, PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type CatalogEntry = {
  name: string;
  muscle: string;
  equipment: Equipment;
  isTimed?: boolean;
};

/** Compact row helper — `x("Name", "Muscle", "BARBELL", true?)`. */
const x = (
  name: string,
  muscle: string,
  equipment: Equipment,
  isTimed = false,
): CatalogEntry => ({ name, muscle, equipment, isTimed });

/**
 * Global exercise catalog — `ownerId: null`, visible to every account. Users add
 * their own private exercises on top of this from the Exercises page.
 */
const CATALOG: CatalogEntry[] = [
  // Chest
  x("Barbell Bench Press", "Chest", "BARBELL"),
  x("Incline Barbell Bench Press", "Chest", "BARBELL"),
  x("Decline Barbell Bench Press", "Chest", "BARBELL"),
  x("Dumbbell Bench Press", "Chest", "DUMBBELL"),
  x("Incline Dumbbell Press", "Chest", "DUMBBELL"),
  x("Dumbbell Fly", "Chest", "DUMBBELL"),
  x("Cable Fly", "Chest", "CABLE"),
  x("Low-to-High Cable Fly", "Chest", "CABLE"),
  x("Machine Chest Press", "Chest", "MACHINE"),
  x("Incline Machine Press", "Chest", "MACHINE"),
  x("Pec Deck", "Chest", "MACHINE"),
  x("Machine Fly", "Chest", "MACHINE"),
  x("Smith Machine Bench Press", "Chest", "MACHINE"),
  x("Push-up", "Chest", "BODYWEIGHT"),
  x("Weighted Dip", "Chest", "BODYWEIGHT"),

  // Back
  x("Deadlift", "Back", "BARBELL"),
  x("Barbell Row", "Back", "BARBELL"),
  x("Pendlay Row", "Back", "BARBELL"),
  x("T-Bar Row", "Back", "MACHINE"),
  x("Rack Pull", "Back", "BARBELL"),
  x("Meadows Row", "Back", "BARBELL"),
  x("Pull-up", "Back", "BODYWEIGHT"),
  x("Chin-up", "Back", "BODYWEIGHT"),
  x("Weighted Pull-up", "Back", "BODYWEIGHT"),
  x("Lat Pulldown", "Back", "CABLE"),
  x("Close-Grip Lat Pulldown", "Back", "CABLE"),
  x("Straight-Arm Pulldown", "Back", "CABLE"),
  x("Seated Cable Row", "Back", "CABLE"),
  x("Chest-Supported Dumbbell Row", "Back", "DUMBBELL"),
  x("Single-Arm Dumbbell Row", "Back", "DUMBBELL"),
  x("Kroc Row", "Back", "DUMBBELL"),
  x("Machine Row", "Back", "MACHINE"),
  x("Chest-Supported Machine Row", "Back", "MACHINE"),
  x("Inverted Row", "Back", "BODYWEIGHT"),
  x("Cable Pullover", "Back", "CABLE"),
  x("Back Extension", "Back", "MACHINE"),
  x("Hyperextension", "Back", "MACHINE"),
  x("Reverse Hyperextension", "Back", "MACHINE"),

  // Traps
  x("Barbell Shrug", "Traps", "BARBELL"),
  x("Dumbbell Shrug", "Traps", "DUMBBELL"),
  x("Trap Bar Shrug", "Traps", "BARBELL"),
  x("Cable Shrug", "Traps", "CABLE"),
  x("Farmer's Carry", "Traps", "DUMBBELL", true),

  // Shoulders
  x("Overhead Press", "Shoulders", "BARBELL"),
  x("Push Press", "Shoulders", "BARBELL"),
  x("Seated Dumbbell Shoulder Press", "Shoulders", "DUMBBELL"),
  x("Arnold Press", "Shoulders", "DUMBBELL"),
  x("Machine Shoulder Press", "Shoulders", "MACHINE"),
  x("Lateral Raise", "Shoulders", "DUMBBELL"),
  x("Cable Lateral Raise", "Shoulders", "CABLE"),
  x("Machine Lateral Raise", "Shoulders", "MACHINE"),
  x("Lu Raise", "Shoulders", "DUMBBELL"),
  x("Front Raise", "Shoulders", "DUMBBELL"),
  x("Rear Delt Fly", "Shoulders", "DUMBBELL"),
  x("Reverse Pec Deck", "Shoulders", "MACHINE"),
  x("Face Pull", "Shoulders", "CABLE"),
  x("Cable Y-Raise", "Shoulders", "CABLE"),
  x("Upright Row", "Shoulders", "BARBELL"),
  x("Cable Upright Row", "Shoulders", "CABLE"),
  x("Landmine Press", "Shoulders", "BARBELL"),
  x("Incline Y-Raise", "Shoulders", "DUMBBELL"),

  // Biceps
  x("Barbell Curl", "Biceps", "BARBELL"),
  x("EZ-Bar Curl", "Biceps", "BARBELL"),
  x("Dumbbell Curl", "Biceps", "DUMBBELL"),
  x("Incline Dumbbell Curl", "Biceps", "DUMBBELL"),
  x("Hammer Curl", "Biceps", "DUMBBELL"),
  x("Preacher Curl", "Biceps", "MACHINE"),
  x("Cable Curl", "Biceps", "CABLE"),
  x("Cable Hammer Curl", "Biceps", "CABLE"),
  x("Bayesian Cable Curl", "Biceps", "CABLE"),
  x("Concentration Curl", "Biceps", "DUMBBELL"),
  x("Spider Curl", "Biceps", "DUMBBELL"),
  x("Machine Curl", "Biceps", "MACHINE"),

  // Triceps
  x("Close-Grip Bench Press", "Triceps", "BARBELL"),
  x("JM Press", "Triceps", "BARBELL"),
  x("Skullcrusher", "Triceps", "BARBELL"),
  x("Triceps Pushdown", "Triceps", "CABLE"),
  x("Rope Pushdown", "Triceps", "CABLE"),
  x("Overhead Cable Extension", "Triceps", "CABLE"),
  x("Overhead Dumbbell Extension", "Triceps", "DUMBBELL"),
  x("Dumbbell Kickback", "Triceps", "DUMBBELL"),
  x("Cable Kickback", "Triceps", "CABLE"),
  x("Machine Triceps Extension", "Triceps", "MACHINE"),
  x("Bench Dip", "Triceps", "BODYWEIGHT"),
  x("Diamond Push-up", "Triceps", "BODYWEIGHT"),

  // Forearms
  x("Wrist Curl", "Forearms", "BARBELL"),
  x("Reverse Wrist Curl", "Forearms", "BARBELL"),
  x("Reverse Curl", "Forearms", "BARBELL"),
  x("Farmer's Hold", "Forearms", "DUMBBELL", true),
  x("Dead Hang", "Forearms", "BODYWEIGHT", true),

  // Quads
  x("Back Squat", "Quads", "BARBELL"),
  x("Front Squat", "Quads", "BARBELL"),
  x("High-Bar Squat", "Quads", "BARBELL"),
  x("Hack Squat", "Quads", "MACHINE"),
  x("Leg Press", "Quads", "MACHINE"),
  x("Smith Machine Squat", "Quads", "MACHINE"),
  x("Pendulum Squat", "Quads", "MACHINE"),
  x("Belt Squat", "Quads", "MACHINE"),
  x("Bulgarian Split Squat", "Quads", "DUMBBELL"),
  x("Walking Lunge", "Quads", "DUMBBELL"),
  x("Reverse Lunge", "Quads", "DUMBBELL"),
  x("Goblet Squat", "Quads", "DUMBBELL"),
  x("Step-up", "Quads", "DUMBBELL"),
  x("Leg Extension", "Quads", "MACHINE"),
  x("Sissy Squat", "Quads", "BODYWEIGHT"),
  x("Wall Sit", "Quads", "BODYWEIGHT", true),

  // Hamstrings
  x("Romanian Deadlift", "Hamstrings", "BARBELL"),
  x("Stiff-Leg Deadlift", "Hamstrings", "BARBELL"),
  x("Dumbbell RDL", "Hamstrings", "DUMBBELL"),
  x("Single-Leg RDL", "Hamstrings", "DUMBBELL"),
  x("Good Morning", "Hamstrings", "BARBELL"),
  x("Lying Leg Curl", "Hamstrings", "MACHINE"),
  x("Seated Leg Curl", "Hamstrings", "MACHINE"),
  x("Standing Leg Curl", "Hamstrings", "MACHINE"),
  x("Nordic Curl", "Hamstrings", "BODYWEIGHT"),
  x("Glute-Ham Raise", "Hamstrings", "MACHINE"),

  // Glutes
  x("Hip Thrust", "Glutes", "BARBELL"),
  x("Sumo Deadlift", "Glutes", "BARBELL"),
  x("Barbell Glute Bridge", "Glutes", "BARBELL"),
  x("Machine Hip Thrust", "Glutes", "MACHINE"),
  x("Cable Pull-Through", "Glutes", "CABLE"),
  x("Curtsy Lunge", "Glutes", "DUMBBELL"),
  x("Cable Glute Kickback", "Glutes", "CABLE"),
  x("Single-Leg Hip Thrust", "Glutes", "DUMBBELL"),
  x("Hip Abduction", "Glutes", "MACHINE"),

  // Calves
  x("Standing Calf Raise", "Calves", "MACHINE"),
  x("Seated Calf Raise", "Calves", "MACHINE"),
  x("Leg Press Calf Raise", "Calves", "MACHINE"),
  x("Single-Leg Calf Raise", "Calves", "DUMBBELL"),
  x("Donkey Calf Raise", "Calves", "MACHINE"),

  // Core
  x("Plank", "Core", "BODYWEIGHT", true),
  x("Side Plank", "Core", "BODYWEIGHT", true),
  x("Hollow Body Hold", "Core", "BODYWEIGHT", true),
  x("L-Sit", "Core", "BODYWEIGHT", true),
  x("Copenhagen Plank", "Core", "BODYWEIGHT", true),
  x("Hanging Leg Raise", "Core", "BODYWEIGHT"),
  x("Hanging Knee Raise", "Core", "BODYWEIGHT"),
  x("Toes-to-Bar", "Core", "BODYWEIGHT"),
  x("Sit-up", "Core", "BODYWEIGHT"),
  x("Weighted Decline Sit-up", "Core", "BODYWEIGHT"),
  x("Crunch", "Core", "BODYWEIGHT"),
  x("Reverse Crunch", "Core", "BODYWEIGHT"),
  x("Bicycle Crunch", "Core", "BODYWEIGHT"),
  x("Dead Bug", "Core", "BODYWEIGHT"),
  x("Cable Crunch", "Core", "CABLE"),
  x("Cable Woodchopper", "Core", "CABLE"),
  x("Ab Wheel Rollout", "Core", "BODYWEIGHT"),
  x("Russian Twist", "Core", "DUMBBELL"),
  x("Pallof Press", "Core", "CABLE"),
  x("Machine Crunch", "Core", "MACHINE"),

  // Full body
  x("Power Clean", "Full body", "BARBELL"),
  x("Hang Clean", "Full body", "BARBELL"),
  x("Clean and Jerk", "Full body", "BARBELL"),
  x("Snatch", "Full body", "BARBELL"),
  x("Thruster", "Full body", "BARBELL"),
  x("Kettlebell Swing", "Full body", "KETTLEBELL"),
  x("Sled Push", "Full body", "MACHINE", true),
  x("Suitcase Carry", "Full body", "DUMBBELL", true),
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
    },
  });

  for (const item of CATALOG) {
    const existing = await prisma.exercise.findFirst({
      where: { ownerId: null, name: item.name },
    });
    const data = {
      muscle: item.muscle,
      equipment: item.equipment,
      isTimed: item.isTimed ?? false,
    };
    if (existing) {
      await prisma.exercise.update({ where: { id: existing.id }, data });
    } else {
      await prisma.exercise.create({
        data: { name: item.name, ownerId: null, ...data },
      });
    }
  }

  // Backfill missing muscle snapshots onto slot rows from their exercise.
  await prisma.$executeRaw`
    UPDATE "WorkoutExercise" we
    SET "muscle" = e."muscle"
    FROM "Exercise" e
    WHERE we."exerciseId" = e."id" AND we."muscle" IS NULL
  `;
  await prisma.$executeRaw`
    UPDATE "TemplateExercise" te
    SET "muscle" = e."muscle"
    FROM "Exercise" e
    WHERE te."exerciseId" = e."id" AND te."muscle" IS NULL
  `;

  console.log(`Seeded ${CATALOG.length} global exercises, demo user ${user.email}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
