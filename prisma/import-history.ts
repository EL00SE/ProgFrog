/**
 * Importer for a personal training log exported as TSV (the columns:
 * Date, Day Label, Workout Type, Exercise, Category, Sets, Reps, Weight,
 * Each Side?, Notes).
 *
 *   npx tsx prisma/import-history.ts <target-email> <path-to.tsv>
 *
 * Wipes the target user's existing workouts, then recreates them from the file.
 * Each exercise is matched against the seeded catalog (with an alias table);
 * anything unmatched becomes a private custom exercise for that user.
 * Re-runnable — safe to run again after adding rows to the sheet.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  type Equipment,
  type ExerciseRole,
  PrismaClient,
} from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TARGET_EMAIL = process.argv[2];
const TSV_PATH = process.argv[3];
if (!TARGET_EMAIL || !TSV_PATH) {
  console.error("usage: npx tsx prisma/import-history.ts <email> <path-to.tsv>");
  process.exit(1);
}

// raw (normalised) name -> catalog exercise name
const ALIASES: Record<string, string> = {
  "cable crossover": "Cable Fly",
  "cable chest fly": "Cable Fly",
  "lower chest cable fly": "Cable Fly",
  "chest fly": "Pec Deck",
  "tricep pushdown": "Triceps Pushdown",
  "one handed tricep pushdown": "Triceps Pushdown",
  "overhead tricep extension": "Overhead Cable Extension",
  "straight arm pushdown": "Straight-Arm Pulldown",
  "cable pullover": "Straight-Arm Pulldown",
  squat: "Back Squat",
  "calf raise": "Standing Calf Raise",
  "leg curl": "Lying Leg Curl",
  "hack squat machine": "Hack Squat",
  "bicep curl": "Dumbbell Curl",
  "cable rope hammer curl": "Cable Curl",
  "machine row": "Machine Row",
  "face pulls": "Face Pull",
  "barbell shrugs": "Barbell Shrug",
  shrugs: "Dumbbell Shrug",
  "shoulder press": "Overhead Press",
  "bench dumbbell press": "Dumbbell Bench Press",
  "flat barbell bench press": "Barbell Bench Press",
  "incline bench press": "Incline Barbell Bench Press",
  "incline bench press machine": "Machine Chest Press",
  "incline machine bench press": "Machine Chest Press",
  "push up": "Push-up",
  dips: "Weighted Dip",
  "dips from bench": "Bench Dip",
  "leg raise": "Hanging Leg Raise",
  "skull crushers": "Skullcrusher",
  "leg press": "Leg Press",
};

// unmatched name -> custom exercise definition
const CUSTOM: Record<
  string,
  { muscle: string; equipment: Equipment; role: ExerciseRole }
> = {
  situps: { muscle: "Core", equipment: "BODYWEIGHT", role: "ACCESSORY" },
  "reverse crunch": { muscle: "Core", equipment: "BODYWEIGHT", role: "ISOLATION" },
  "cable woodchoppers": { muscle: "Core", equipment: "CABLE", role: "ACCESSORY" },
  "upright row": { muscle: "Shoulders", equipment: "BARBELL", role: "SECONDARY" },
  "plate press out": { muscle: "Shoulders", equipment: "OTHER", role: "ACCESSORY" },
  "incline bench y-raise": {
    muscle: "Traps",
    equipment: "DUMBBELL",
    role: "ACCESSORY",
  },
  "777 bicep curls": { muscle: "Biceps", equipment: "DUMBBELL", role: "ISOLATION" },
};

const norm = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.]/g, "");

function inferMuscle(category: string, exercise: string): string {
  const c = category.trim();
  if (c && c !== "Legs" && c !== "Cardio") return c;
  const e = exercise.toLowerCase();
  if (/calf/.test(e)) return "Calves";
  if (/(rdl|romanian|leg curl|deadlift|ham)/.test(e)) return "Hamstrings";
  return "Quads";
}

function inferEquipment(notes: string): Equipment {
  const n = notes.toLowerCase();
  if (/dumbbell/.test(n)) return "DUMBBELL";
  if (/cable/.test(n)) return "CABLE";
  if (/machine/.test(n)) return "MACHINE";
  if (/barbell/.test(n)) return "BARBELL";
  if (/bodyweight/.test(n)) return "BODYWEIGHT";
  return "OTHER";
}

function parseDate(raw: string): Date {
  const [d, m] = raw.trim().split("/").map(Number);
  // The sheet has a couple of year typos (2025, 2029); everything is 2026.
  return new Date(2026, m - 1, d, 12, 0, 0);
}

type Row = {
  date: string;
  dayLabel: string;
  type: string;
  exercise: string;
  category: string;
  sets: string;
  reps: string;
  weight: string;
  eachSide: string;
  notes: string;
};

async function main() {
  const user = await prisma.user.upsert({
    where: { email: TARGET_EMAIL },
    update: {},
    create: { email: TARGET_EMAIL, name: TARGET_EMAIL.split("@")[0] },
  });

  const catalog = await prisma.exercise.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: user.id }] },
  });
  const byNorm = new Map(catalog.map((e) => [norm(e.name), e]));

  async function resolve(rawName: string, category: string, notes: string) {
    const key = norm(rawName);
    const aliased = ALIASES[key];
    const hit = byNorm.get(norm(aliased ?? rawName));
    if (hit) return hit;

    const def = CUSTOM[key] ?? {
      muscle: inferMuscle(category, rawName),
      equipment: inferEquipment(notes),
      role: "SECONDARY" as ExerciseRole,
    };
    const created = await prisma.exercise.upsert({
      where: { ownerId_name: { ownerId: user.id, name: rawName.trim() } },
      update: {},
      create: { name: rawName.trim(), ownerId: user.id, ...def },
    });
    byNorm.set(norm(created.name), created);
    return created;
  }

  const lines = readFileSync(TSV_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const rows: Row[] = lines.slice(1).map((l) => {
    const c = l.split("\t");
    return {
      date: c[0] ?? "",
      dayLabel: c[1] ?? "",
      type: c[2] ?? "",
      exercise: c[3] ?? "",
      category: c[4] ?? "",
      sets: c[5] ?? "",
      reps: c[6] ?? "",
      weight: c[7] ?? "",
      eachSide: c[8] ?? "",
      notes: c[9] ?? "",
    };
  });

  const days = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.date) continue;
    days.set(`${r.date}|${r.dayLabel}`, [
      ...(days.get(`${r.date}|${r.dayLabel}`) ?? []),
      r,
    ]);
  }

  await prisma.workout.deleteMany({ where: { userId: user.id } });

  let workouts = 0;
  let entries = 0;
  let sets = 0;
  const customNames = new Set<string>();

  for (const dayRows of days.values()) {
    const first = dayRows[0];
    const date = parseDate(first.date);
    const name = [first.dayLabel, first.type].filter(Boolean).join(" · ");

    const order: string[] = [];
    const merged = new Map<
      string,
      { raw: string; category: string; notes: string[]; each: boolean; superset: boolean }
    >();
    const setsFor = new Map<
      string,
      { reps: number; seconds: number; weight: number; drop: boolean }[]
    >();

    for (const r of dayRows) {
      if (!r.exercise || /didnt record/i.test(r.exercise)) continue;
      if (r.category.trim() === "Cardio" || /^run$/i.test(r.exercise.trim())) continue;

      const key = norm(r.exercise);
      if (!merged.has(key)) {
        order.push(key);
        merged.set(key, {
          raw: r.exercise,
          category: r.category,
          notes: [],
          each: false,
          superset: false,
        });
        setsFor.set(key, []);
      }
      const m = merged.get(key)!;
      if (r.notes.trim()) m.notes.push(r.notes.trim());
      if (/yes/i.test(r.eachSide)) m.each = true;
      if (/superset/i.test(r.notes)) m.superset = true;

      const timed = key === "plank";
      const count = Math.max(parseInt(r.sets, 10) || (r.reps ? 1 : 0), 0);
      const repsRaw = r.reps.trim();
      const isFailure = /^f$/i.test(repsRaw);
      const reps = timed ? 0 : isFailure ? 8 : parseInt(repsRaw, 10) || 0;
      const seconds = timed ? parseInt(repsRaw, 10) || 0 : 0;
      let weight = parseFloat(r.weight) || 0;
      if (weight < 0) {
        m.notes.push(`assisted ${Math.abs(weight)}kg`);
        weight = 0;
      }
      if (isFailure) m.notes.push("to failure");
      const drop = /drop set/i.test(r.notes);
      for (let i = 0; i < count; i++) {
        setsFor.get(key)!.push({ reps, seconds, weight, drop });
      }
    }

    const exEntries = await Promise.all(
      order.map(async (key, i) => {
        const m = merged.get(key)!;
        const ex = await resolve(m.raw, m.category, m.notes.join(" "));
        if (ex.ownerId === user.id) customNames.add(ex.name);
        const noteBits = [...new Set(m.notes)];
        if (m.each) noteBits.unshift("weights are per side");
        return {
          exerciseId: ex.id,
          muscle: ex.muscle,
          role: ex.role,
          equipment: ex.equipment,
          order: i,
          supersetGroup: m.superset ? 1 : null,
          notes: noteBits.join(" · ") || null,
          setCreate: setsFor.get(key)!.map((s, si) => ({
            order: si,
            reps: s.reps,
            seconds: s.seconds || null,
            weight: s.weight,
            isDropSet: s.drop,
          })),
        };
      }),
    );

    const withSets = exEntries.filter((e) => e.setCreate.length > 0);

    await prisma.workout.create({
      data: {
        userId: user.id,
        name: name || first.dayLabel || "Workout",
        date,
        finishedAt: date,
        unit: "KG",
        notes: withSets.length ? null : "Trained — sets not recorded",
        exercises: {
          create: withSets.map(({ setCreate, ...e }) => ({
            ...e,
            sets: { create: setCreate },
          })),
        },
      },
    });

    workouts += 1;
    entries += withSets.length;
    sets += withSets.reduce((n, e) => n + e.setCreate.length, 0);
  }

  console.log(
    `Imported ${workouts} workouts, ${entries} exercise entries, ${sets} sets for ${user.email}.`,
  );
  if (customNames.size) {
    console.log(`Custom exercises: ${[...customNames].sort().join(", ")}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
