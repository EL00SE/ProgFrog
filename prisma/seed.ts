import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  type Equipment,
  type ExerciseRole,
  PrismaClient,
} from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type CatalogEntry = {
  name: string;
  muscle: string;
  equipment: Equipment;
  role: ExerciseRole;
  isTimed?: boolean;
};

/** Compact row helper — `x("Name", "Muscle", "BARBELL", "MAIN", true?)`. */
const x = (
  name: string,
  muscle: string,
  equipment: Equipment,
  role: ExerciseRole,
  isTimed = false,
): CatalogEntry => ({ name, muscle, equipment, role, isTimed });

/**
 * Global exercise catalog — `ownerId: null`, visible to every account. Users add
 * their own private exercises on top of this from the Exercises page.
 */
const CATALOG: CatalogEntry[] = [
  // Chest
  x("Barbell Bench Press", "Chest", "BARBELL", "MAIN"),
  x("Incline Barbell Bench Press", "Chest", "BARBELL", "MAIN"),
  x("Decline Barbell Bench Press", "Chest", "BARBELL", "SECONDARY"),
  x("Dumbbell Bench Press", "Chest", "DUMBBELL", "SECONDARY"),
  x("Incline Dumbbell Press", "Chest", "DUMBBELL", "SECONDARY"),
  x("Dumbbell Fly", "Chest", "DUMBBELL", "ISOLATION"),
  x("Cable Fly", "Chest", "CABLE", "ISOLATION"),
  x("Low-to-High Cable Fly", "Chest", "CABLE", "ISOLATION"),
  x("Machine Chest Press", "Chest", "MACHINE", "SECONDARY"),
  x("Pec Deck", "Chest", "MACHINE", "ISOLATION"),
  x("Push-up", "Chest", "BODYWEIGHT", "ACCESSORY"),
  x("Weighted Dip", "Chest", "BODYWEIGHT", "SECONDARY"),

  // Back
  x("Deadlift", "Back", "BARBELL", "MAIN"),
  x("Barbell Row", "Back", "BARBELL", "MAIN"),
  x("Pendlay Row", "Back", "BARBELL", "MAIN"),
  x("T-Bar Row", "Back", "MACHINE", "MAIN"),
  x("Rack Pull", "Back", "BARBELL", "SECONDARY"),
  x("Meadows Row", "Back", "BARBELL", "SECONDARY"),
  x("Pull-up", "Back", "BODYWEIGHT", "MAIN"),
  x("Chin-up", "Back", "BODYWEIGHT", "MAIN"),
  x("Weighted Pull-up", "Back", "BODYWEIGHT", "MAIN"),
  x("Lat Pulldown", "Back", "CABLE", "SECONDARY"),
  x("Close-Grip Lat Pulldown", "Back", "CABLE", "SECONDARY"),
  x("Straight-Arm Pulldown", "Back", "CABLE", "ISOLATION"),
  x("Seated Cable Row", "Back", "CABLE", "SECONDARY"),
  x("Chest-Supported Dumbbell Row", "Back", "DUMBBELL", "SECONDARY"),
  x("Single-Arm Dumbbell Row", "Back", "DUMBBELL", "SECONDARY"),
  x("Machine Row", "Back", "MACHINE", "SECONDARY"),

  // Traps
  x("Barbell Shrug", "Traps", "BARBELL", "ISOLATION"),
  x("Dumbbell Shrug", "Traps", "DUMBBELL", "ISOLATION"),
  x("Trap Bar Shrug", "Traps", "BARBELL", "ISOLATION"),
  x("Cable Shrug", "Traps", "CABLE", "ISOLATION"),
  x("Farmer's Carry", "Traps", "DUMBBELL", "ACCESSORY", true),

  // Shoulders
  x("Overhead Press", "Shoulders", "BARBELL", "MAIN"),
  x("Push Press", "Shoulders", "BARBELL", "MAIN"),
  x("Seated Dumbbell Shoulder Press", "Shoulders", "DUMBBELL", "SECONDARY"),
  x("Arnold Press", "Shoulders", "DUMBBELL", "SECONDARY"),
  x("Machine Shoulder Press", "Shoulders", "MACHINE", "SECONDARY"),
  x("Lateral Raise", "Shoulders", "DUMBBELL", "ISOLATION"),
  x("Cable Lateral Raise", "Shoulders", "CABLE", "ISOLATION"),
  x("Machine Lateral Raise", "Shoulders", "MACHINE", "ISOLATION"),
  x("Lu Raise", "Shoulders", "DUMBBELL", "ISOLATION"),
  x("Front Raise", "Shoulders", "DUMBBELL", "ISOLATION"),
  x("Rear Delt Fly", "Shoulders", "DUMBBELL", "ISOLATION"),
  x("Reverse Pec Deck", "Shoulders", "MACHINE", "ISOLATION"),
  x("Face Pull", "Shoulders", "CABLE", "ACCESSORY"),
  x("Cable Y-Raise", "Shoulders", "CABLE", "ACCESSORY"),

  // Biceps
  x("Barbell Curl", "Biceps", "BARBELL", "SECONDARY"),
  x("EZ-Bar Curl", "Biceps", "BARBELL", "SECONDARY"),
  x("Dumbbell Curl", "Biceps", "DUMBBELL", "ISOLATION"),
  x("Incline Dumbbell Curl", "Biceps", "DUMBBELL", "ISOLATION"),
  x("Hammer Curl", "Biceps", "DUMBBELL", "ISOLATION"),
  x("Preacher Curl", "Biceps", "MACHINE", "ISOLATION"),
  x("Cable Curl", "Biceps", "CABLE", "ISOLATION"),
  x("Bayesian Cable Curl", "Biceps", "CABLE", "ISOLATION"),
  x("Concentration Curl", "Biceps", "DUMBBELL", "ISOLATION"),
  x("Spider Curl", "Biceps", "DUMBBELL", "ISOLATION"),

  // Triceps
  x("Close-Grip Bench Press", "Triceps", "BARBELL", "SECONDARY"),
  x("JM Press", "Triceps", "BARBELL", "SECONDARY"),
  x("Skullcrusher", "Triceps", "BARBELL", "ISOLATION"),
  x("Triceps Pushdown", "Triceps", "CABLE", "ISOLATION"),
  x("Rope Pushdown", "Triceps", "CABLE", "ISOLATION"),
  x("Overhead Cable Extension", "Triceps", "CABLE", "ISOLATION"),
  x("Overhead Dumbbell Extension", "Triceps", "DUMBBELL", "ISOLATION"),
  x("Dumbbell Kickback", "Triceps", "DUMBBELL", "ISOLATION"),
  x("Bench Dip", "Triceps", "BODYWEIGHT", "ISOLATION"),
  x("Diamond Push-up", "Triceps", "BODYWEIGHT", "ACCESSORY"),

  // Forearms
  x("Wrist Curl", "Forearms", "BARBELL", "ISOLATION"),
  x("Reverse Wrist Curl", "Forearms", "BARBELL", "ISOLATION"),
  x("Reverse Curl", "Forearms", "BARBELL", "ISOLATION"),
  x("Farmer's Hold", "Forearms", "DUMBBELL", "ACCESSORY", true),
  x("Dead Hang", "Forearms", "BODYWEIGHT", "ACCESSORY", true),

  // Quads
  x("Back Squat", "Quads", "BARBELL", "MAIN"),
  x("Front Squat", "Quads", "BARBELL", "MAIN"),
  x("High-Bar Squat", "Quads", "BARBELL", "MAIN"),
  x("Hack Squat", "Quads", "MACHINE", "SECONDARY"),
  x("Leg Press", "Quads", "MACHINE", "SECONDARY"),
  x("Belt Squat", "Quads", "MACHINE", "SECONDARY"),
  x("Bulgarian Split Squat", "Quads", "DUMBBELL", "SECONDARY"),
  x("Walking Lunge", "Quads", "DUMBBELL", "SECONDARY"),
  x("Reverse Lunge", "Quads", "DUMBBELL", "SECONDARY"),
  x("Goblet Squat", "Quads", "DUMBBELL", "SECONDARY"),
  x("Step-up", "Quads", "DUMBBELL", "SECONDARY"),
  x("Leg Extension", "Quads", "MACHINE", "ISOLATION"),
  x("Sissy Squat", "Quads", "BODYWEIGHT", "ISOLATION"),
  x("Wall Sit", "Quads", "BODYWEIGHT", "ACCESSORY", true),

  // Hamstrings
  x("Romanian Deadlift", "Hamstrings", "BARBELL", "MAIN"),
  x("Stiff-Leg Deadlift", "Hamstrings", "BARBELL", "SECONDARY"),
  x("Dumbbell RDL", "Hamstrings", "DUMBBELL", "SECONDARY"),
  x("Single-Leg RDL", "Hamstrings", "DUMBBELL", "SECONDARY"),
  x("Good Morning", "Hamstrings", "BARBELL", "SECONDARY"),
  x("Lying Leg Curl", "Hamstrings", "MACHINE", "ISOLATION"),
  x("Seated Leg Curl", "Hamstrings", "MACHINE", "ISOLATION"),
  x("Nordic Curl", "Hamstrings", "BODYWEIGHT", "ISOLATION"),
  x("Glute-Ham Raise", "Hamstrings", "MACHINE", "ISOLATION"),

  // Glutes
  x("Hip Thrust", "Glutes", "BARBELL", "MAIN"),
  x("Sumo Deadlift", "Glutes", "BARBELL", "MAIN"),
  x("Barbell Glute Bridge", "Glutes", "BARBELL", "SECONDARY"),
  x("Machine Hip Thrust", "Glutes", "MACHINE", "SECONDARY"),
  x("Cable Pull-Through", "Glutes", "CABLE", "SECONDARY"),
  x("Curtsy Lunge", "Glutes", "DUMBBELL", "SECONDARY"),
  x("Cable Kickback", "Glutes", "CABLE", "ISOLATION"),
  x("Hip Abduction", "Glutes", "MACHINE", "ISOLATION"),

  // Calves
  x("Standing Calf Raise", "Calves", "MACHINE", "ISOLATION"),
  x("Seated Calf Raise", "Calves", "MACHINE", "ISOLATION"),
  x("Leg Press Calf Raise", "Calves", "MACHINE", "ISOLATION"),
  x("Single-Leg Calf Raise", "Calves", "DUMBBELL", "ISOLATION"),
  x("Donkey Calf Raise", "Calves", "MACHINE", "ISOLATION"),

  // Core
  x("Plank", "Core", "BODYWEIGHT", "ACCESSORY", true),
  x("Side Plank", "Core", "BODYWEIGHT", "ACCESSORY", true),
  x("Hollow Body Hold", "Core", "BODYWEIGHT", "ACCESSORY", true),
  x("L-Sit", "Core", "BODYWEIGHT", "ACCESSORY", true),
  x("Copenhagen Plank", "Core", "BODYWEIGHT", "ACCESSORY", true),
  x("Hanging Leg Raise", "Core", "BODYWEIGHT", "ISOLATION"),
  x("Hanging Knee Raise", "Core", "BODYWEIGHT", "ISOLATION"),
  x("Cable Crunch", "Core", "CABLE", "ISOLATION"),
  x("Ab Wheel Rollout", "Core", "BODYWEIGHT", "ISOLATION"),
  x("Weighted Decline Sit-up", "Core", "BODYWEIGHT", "ISOLATION"),
  x("Russian Twist", "Core", "DUMBBELL", "ISOLATION"),
  x("Pallof Press", "Core", "CABLE", "ACCESSORY"),

  // Full body
  x("Power Clean", "Full body", "BARBELL", "MAIN"),
  x("Hang Clean", "Full body", "BARBELL", "MAIN"),
  x("Clean and Jerk", "Full body", "BARBELL", "MAIN"),
  x("Snatch", "Full body", "BARBELL", "MAIN"),
  x("Thruster", "Full body", "BARBELL", "SECONDARY"),
  x("Kettlebell Swing", "Full body", "KETTLEBELL", "SECONDARY"),
  x("Sled Push", "Full body", "MACHINE", "ACCESSORY", true),
  x("Suitcase Carry", "Full body", "DUMBBELL", "ACCESSORY", true),
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
      role: item.role,
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

  // Backfill muscle/role snapshots onto slot rows created before roles existed.
  const backfilled = await prisma.$executeRaw`
    UPDATE "WorkoutExercise" we
    SET "role" = e."role", "muscle" = COALESCE(we."muscle", e."muscle")
    FROM "Exercise" e
    WHERE we."exerciseId" = e."id" AND we."role" IS NULL
  `;
  await prisma.$executeRaw`
    UPDATE "TemplateExercise" te
    SET "role" = e."role", "muscle" = COALESCE(te."muscle", e."muscle")
    FROM "Exercise" e
    WHERE te."exerciseId" = e."id" AND te."role" IS NULL
  `;

  console.log(
    `Seeded ${CATALOG.length} global exercises, backfilled ${backfilled} workout slot(s), demo user ${user.email}.`,
  );
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
