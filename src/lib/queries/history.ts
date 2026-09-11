import "server-only";

import { prisma } from "@/lib/prisma";
import {
  convertWeight,
  localDateKey,
  type SetType,
  type WeightUnit,
} from "@/lib/training";

export type PrevSet = {
  weight: number;
  reps: number;
  seconds: number | null;
  type: SetType;
  toFailure: boolean;
};
export type ExercisePrev = { date: string; equipment: string; sets: PrevSet[] };

/**
 * The last time the user did each exercise (finished workouts only), keyed by
 * exercise id. Weights are in `displayUnit`. Used to surface recents in the
 * picker and show "last time" on a mid-workout exercise — warm-ups included,
 * so the recap matches what was actually done that session. Equipment is
 * included too: some exercises (Shrug, Curl, Row…) are logged under barbell,
 * dumbbell, cable, and machine variants alike, so last time's weight is only
 * meaningful next to which one it was.
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
      exercise: { select: { equipment: true } },
    },
  });

  const out: Record<string, ExercisePrev> = {};
  for (const we of rows) {
    if (!we.exerciseId || out[we.exerciseId]) continue; // first row = most recent
    const sets = we.sets
      .filter((s) => s.reps > 0 || (s.seconds ?? 0) > 0)
      .map((s) => ({
        weight: round(convertWeight(s.weight, we.workout.unit, displayUnit)),
        reps: s.reps,
        seconds: s.seconds,
        type: s.type,
        toFailure: s.toFailure,
      }));
    if (sets.length === 0) continue;
    out[we.exerciseId] = {
      date: localDateKey(we.workout.date),
      equipment: we.equipment ?? we.exercise?.equipment ?? "OTHER",
      sets,
    };
  }
  return out;
}

function round(n: number) {
  return Math.round(n * 2) / 2;
}
