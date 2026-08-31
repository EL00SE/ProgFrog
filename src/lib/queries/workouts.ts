import "server-only";

import { prisma } from "@/lib/prisma";
import {
  convertWeight,
  isWorkingSet,
  roleLabel,
  type SetLike,
  startOfWeek,
  type WeightUnit,
  weeklyStreak,
  workingReps,
  workoutVolume,
} from "@/lib/training";

const workoutInclude = {
  exercises: {
    orderBy: { order: "asc" },
    include: {
      // Only the fields the logger / history / summary actually read.
      exercise: {
        select: { id: true, name: true, equipment: true, isTimed: true },
      },
      sets: { orderBy: { order: "asc" } },
    },
  },
} as const;

/** Full workout with its exercises and sets — scoped to the owner. */
export function getWorkout(userId: string, workoutId: string) {
  return prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: workoutInclude,
  });
}

export type FullWorkout = NonNullable<Awaited<ReturnType<typeof getWorkout>>>;

/** The user's in-progress workout (no `finishedAt`), if any. */
export function getActiveWorkout(userId: string) {
  return prisma.workout.findFirst({
    where: { userId, finishedAt: null },
    orderBy: { createdAt: "desc" },
    include: workoutInclude,
  });
}

export async function getWorkoutHistory(userId: string) {
  const workouts = await prisma.workout.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { date: "desc" },
    include: workoutInclude,
  });
  return workouts.map(summarizeWorkout);
}

type WorkoutWithSets = Awaited<ReturnType<typeof getActiveWorkout>>;

export function summarizeWorkout(w: NonNullable<WorkoutWithSets>) {
  const allSets: SetLike[] = w.exercises.flatMap((we) =>
    we.sets.map((s) => ({
      reps: s.reps,
      weight: s.weight,
      type: s.type,
    })),
  );
  return {
    id: w.id,
    name: w.name,
    date: w.date,
    unit: w.unit,
    finishedAt: w.finishedAt,
    exerciseCount: w.exercises.length,
    setCount: allSets.filter(isWorkingSet).length,
    volume: workoutVolume(allSets),
    exerciseNames: [
      ...new Set(
        w.exercises.map((we) => we.exercise?.name ?? roleLabel(we.muscle, we.role)),
      ),
    ],
  };
}

export type WorkoutSummary = ReturnType<typeof summarizeWorkout>;

type Totals = { workouts: number; sets: number; reps: number; volume: number };

function emptyTotals(): Totals {
  return { workouts: 0, sets: 0, reps: 0, volume: 0 };
}

/**
 * Everything the dashboard needs, from a single scan of the user's finished
 * workouts: lifetime totals, this-week vs last-week, the consecutive-week
 * streak, and the most recent few (summarised). All weights in `displayUnit`.
 */
export async function getDashboardData(
  userId: string,
  displayUnit: WeightUnit,
  recentCount = 6,
) {
  const workouts = await prisma.workout.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { date: "desc" },
    include: workoutInclude,
  });

  const thisWeekStart = startOfWeek(new Date()).getTime();
  const lastWeekStart = startOfWeek(
    new Date(thisWeekStart - 7 * 24 * 60 * 60 * 1000),
  ).getTime();

  const lifetime = emptyTotals();
  const thisWeek = emptyTotals();
  const lastWeek = emptyTotals();

  for (const w of workouts) {
    const sets: SetLike[] = w.exercises.flatMap((we) =>
      we.sets.map((s) => ({
        reps: s.reps,
        weight: s.weight,
        type: s.type,
      })),
    );
    const working = sets.filter(isWorkingSet);
    const entry = {
      workouts: 1,
      sets: working.length,
      reps: workingReps(sets),
      volume: convertWeight(workoutVolume(sets), w.unit, displayUnit),
    };

    add(lifetime, entry);
    const bucket = startOfWeek(w.date).getTime();
    if (bucket === thisWeekStart) add(thisWeek, entry);
    else if (bucket === lastWeekStart) add(lastWeek, entry);
  }

  return {
    stats: {
      lifetime,
      thisWeek,
      lastWeek,
      streakWeeks: weeklyStreak(workouts.map((w) => w.date)),
      lastWorkoutDate: workouts[0]?.date ?? null,
    },
    recent: workouts.slice(0, recentCount).map(summarizeWorkout),
  };
}

function add(acc: Totals, e: Totals) {
  acc.workouts += e.workouts;
  acc.sets += e.sets;
  acc.reps += e.reps;
  acc.volume += e.volume;
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardData>>["stats"];
