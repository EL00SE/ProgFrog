import "server-only";

import { prisma } from "@/lib/prisma";
import {
  best1RM,
  convertWeight,
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

/** Specific exercises the user has logged at least one set for. */
export async function getTrackedExercises(userId: string) {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { not: null },
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    select: {
      exerciseId: true,
      exercise: { select: { id: true, name: true, muscle: true } },
    },
    distinct: ["exerciseId"],
    orderBy: { exercise: { name: "asc" } },
  });

  const seen = new Map<string, NonNullable<(typeof rows)[number]["exercise"]>>();
  for (const r of rows) if (r.exercise) seen.set(r.exercise.id, r.exercise);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
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

type WhereEntry = { exerciseId: string } | { muscle: string };

async function buildSeries(
  userId: string,
  key: string,
  title: string,
  entryWhere: WhereEntry,
  displayUnit: WeightUnit,
): Promise<ProgressSeries> {
  const entries = await prisma.workoutExercise.findMany({
    where: {
      ...entryWhere,
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    include: { sets: true, workout: { select: { date: true, unit: true } } },
    orderBy: { workout: { date: "asc" } },
  });

  // One point per calendar day (entries from the same session are merged).
  const byDate = new Map<string, SetLike[]>();
  for (const we of entries) {
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
  exerciseId: string,
  displayUnit: WeightUnit,
): Promise<ProgressSeries | null> {
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true, name: true },
  });
  if (!exercise) return null;
  return buildSeries(userId, exercise.id, exercise.name, { exerciseId }, displayUnit);
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
