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
/** One past session of an exercise: when, and what was done. */
export type PrevSession = { date: string; sets: PrevSet[] };

/**
 * The most recent session of an exercise (`equipment` is what it was done
 * with), plus the most recent session per equipment — a dumbbell set isn't
 * comparable to a barbell one, so the logger looks up the equipment on the card.
 */
export type ExercisePrev = PrevSession & {
  equipment: string;
  byEquipment: Record<string, PrevSession>;
};

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
    if (!we.exerciseId) continue;
    const equipment = we.equipment ?? we.exercise?.equipment ?? "OTHER";
    // Rows run newest first, so the first seen per equipment is its latest.
    if (out[we.exerciseId]?.byEquipment[equipment]) continue;
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
    const session = { date: localDateKey(we.workout.date), sets };
    const entry = (out[we.exerciseId] ??= { ...session, equipment, byEquipment: {} });
    entry.byEquipment[equipment] = session;
  }
  return out;
}

function round(n: number) {
  return Math.round(n * 2) / 2;
}
