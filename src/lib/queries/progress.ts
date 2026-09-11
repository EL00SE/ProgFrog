import "server-only";

import { prisma } from "@/lib/prisma";
import {
  best1RM,
  convertWeight,
  EQUIPMENT_LABELS,
  localDateKey,
  MUSCLE_GROUPS,
  personalRecords,
  type SessionPoint,
  type SetLike,
  topSet,
  type WeightUnit,
  workoutVolume,
} from "@/lib/training";

// ---------------------------------------------------------------------------
// By exercise
// ---------------------------------------------------------------------------

/** Joins an exercise id and an equipment variant into one tracked-exercise key. */
const EQUIPMENT_KEY_SEP = "~";

/**
 * Specific exercises the user has logged at least one set for. Some exercises
 * (Shrug, Curl, Row…) get logged under more than one equipment — a barbell
 * one week, a cable machine the next — and lumping those together would trend
 * a mix of two different lifts. When an exercise has more than one equipment
 * on record, it's split into one tracked entry per equipment instead of one
 * per exercise; an exercise only ever done one way stays a single entry.
 */
export async function getTrackedExercises(userId: string) {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { not: null },
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    select: {
      exerciseId: true,
      equipment: true,
      exercise: { select: { id: true, name: true, muscle: true, equipment: true } },
    },
    distinct: ["exerciseId", "equipment"],
    orderBy: { exercise: { name: "asc" } },
  });

  const byExercise = new Map<
    string,
    { name: string; muscle: string | null; equipment: Set<string> }
  >();
  for (const r of rows) {
    if (!r.exercise) continue;
    const resolved = r.equipment ?? r.exercise.equipment ?? "OTHER";
    const entry = byExercise.get(r.exercise.id) ?? {
      name: r.exercise.name,
      muscle: r.exercise.muscle,
      equipment: new Set<string>(),
    };
    entry.equipment.add(resolved);
    byExercise.set(r.exercise.id, entry);
  }

  const out: { id: string; name: string; muscle: string | null }[] = [];
  for (const [exerciseId, { name, muscle, equipment }] of byExercise) {
    if (equipment.size <= 1) {
      out.push({ id: exerciseId, name, muscle });
      continue;
    }
    for (const eq of equipment) {
      out.push({
        id: `${exerciseId}${EQUIPMENT_KEY_SEP}${eq}`,
        name: `${name} (${EQUIPMENT_LABELS[eq] ?? eq})`,
        muscle,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// By muscle group
// ---------------------------------------------------------------------------

export type TrackedMuscle = { key: string; muscle: string; label: string };

/** Muscle groups the user has logged sets against (any exercise or slot). */
export async function getTrackedMuscles(userId: string): Promise<TrackedMuscle[]> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      muscle: { not: null },
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    select: { muscle: true },
    distinct: ["muscle"],
  });

  const order = (m: string) => {
    const i = (MUSCLE_GROUPS as readonly string[]).indexOf(m);
    return i === -1 ? MUSCLE_GROUPS.length : i;
  };
  return rows
    .filter((r): r is { muscle: string } => !!r.muscle)
    .map((r) => ({ key: r.muscle, muscle: r.muscle, label: r.muscle }))
    .sort(
      (a, b) => order(a.muscle) - order(b.muscle) || a.muscle.localeCompare(b.muscle),
    );
}

// ---------------------------------------------------------------------------
// Shared series shape
// ---------------------------------------------------------------------------

export type ProgressSeries = {
  key: string;
  title: string;
  unit: WeightUnit;
  points: SessionPoint[];
  prs: ReturnType<typeof personalRecords>;
};

type WhereEntry = { exerciseId: string; equipment?: string } | { muscle: string };

function isExerciseWhere(w: WhereEntry): w is { exerciseId: string; equipment?: string } {
  return "exerciseId" in w;
}

async function buildSeries(
  userId: string,
  key: string,
  title: string,
  entryWhere: WhereEntry,
  displayUnit: WeightUnit,
): Promise<ProgressSeries> {
  // The equipment split is resolved in JS (not the Prisma `where`) because a
  // WorkoutExercise's equipment can be null, falling back to the exercise's
  // own default — a plain equality filter would miss those rows.
  const equipmentFilter = isExerciseWhere(entryWhere) ? entryWhere.equipment : undefined;
  const prismaWhere = isExerciseWhere(entryWhere)
    ? { exerciseId: entryWhere.exerciseId }
    : { muscle: entryWhere.muscle };

  const entries = await prisma.workoutExercise.findMany({
    where: {
      ...prismaWhere,
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    include: {
      sets: true,
      workout: { select: { date: true, unit: true } },
      exercise: { select: { equipment: true } },
    },
    orderBy: { workout: { date: "asc" } },
  });
  const filtered = equipmentFilter
    ? entries.filter(
        (we) => (we.equipment ?? we.exercise?.equipment ?? "OTHER") === equipmentFilter,
      )
    : entries;

  // One point per calendar day (entries from the same session are merged).
  const byDate = new Map<string, SetLike[]>();
  for (const we of filtered) {
    const k = localDateKey(we.workout.date);
    const sets = we.sets.map<SetLike>((s) => ({
      reps: s.reps,
      type: s.type,
      weight: convertWeight(s.weight, we.workout.unit, displayUnit),
    }));
    byDate.set(k, [...(byDate.get(k) ?? []), ...sets]);
  }

  const points: SessionPoint[] = [...byDate.entries()]
    .map(([date, sets]) => {
      const best = topSet(sets);
      return {
        date,
        best1RM: round(best1RM(sets)),
        topSetWeight: round(best?.weight ?? 0),
        volume: round(workoutVolume(sets)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return { key, title, unit: displayUnit, points, prs: personalRecords(points) };
}

export async function getExerciseProgress(
  userId: string,
  key: string,
  displayUnit: WeightUnit,
): Promise<ProgressSeries | null> {
  // `key` is either a bare exercise id, or "<exerciseId>~<EQUIPMENT>" for one
  // of several equipment variants split out by getTrackedExercises().
  const [exerciseId, equipment] = key.split(EQUIPMENT_KEY_SEP);
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, name: true },
  });
  if (!exercise) return null;
  const title = equipment
    ? `${exercise.name} (${EQUIPMENT_LABELS[equipment] ?? equipment})`
    : exercise.name;
  return buildSeries(
    userId,
    key,
    title,
    { exerciseId: exercise.id, equipment },
    displayUnit,
  );
}

export async function getMuscleProgress(
  userId: string,
  muscle: string,
  displayUnit: WeightUnit,
): Promise<ProgressSeries | null> {
  if (!muscle) return null;
  return buildSeries(userId, muscle, muscle, { muscle }, displayUnit);
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
