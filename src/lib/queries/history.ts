import "server-only";

import { prisma } from "@/lib/prisma";
import { convertWeight, localDateKey, type WeightUnit } from "@/lib/training";

export type PrevSet = { weight: number; reps: number; seconds: number | null };
export type ExercisePrev = { date: string; sets: PrevSet[] };

/**
 * The last time the user did each exercise (finished workouts only), keyed by
 * exercise id. Weights are in `displayUnit`. Used to surface recents in the
 * picker and show "last time" on a mid-workout exercise.
 */
export async function getExercisePrev(
  userId: string,
  displayUnit: WeightUnit,
): Promise<Record<string, ExercisePrev>> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { not: null },
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    orderBy: { workout: { date: "desc" } },
    include: {
      sets: { orderBy: { order: "asc" } },
      workout: { select: { date: true, unit: true } },
    },
  });

  const out: Record<string, ExercisePrev> = {};
  for (const we of rows) {
    if (!we.exerciseId || out[we.exerciseId]) continue; // first row = most recent
    const sets = we.sets
      .filter((s) => s.type !== "WARMUP" && (s.reps > 0 || (s.seconds ?? 0) > 0))
      .map((s) => ({
        weight: round(convertWeight(s.weight, we.workout.unit, displayUnit)),
        reps: s.reps,
        seconds: s.seconds,
      }));
    if (sets.length === 0) continue;
    out[we.exerciseId] = { date: localDateKey(we.workout.date), sets };
  }
  return out;
}

function round(n: number) {
  return Math.round(n * 2) / 2;
}
