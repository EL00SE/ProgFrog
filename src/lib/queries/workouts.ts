import "server-only";

import { prisma } from "@/lib/prisma";
import {
  convertWeight,
  isWorkingSet,
  localDateKey,
  MUSCLE_GROUPS,
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
      // Only the fields the logger / history / summary / stats actually read.
      exercise: {
        select: { id: true, name: true, equipment: true, isTimed: true, muscle: true },
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
  // Chronological session number — the oldest finished workout is #1.
  return workouts.map((w, i) => summarizeWorkout(w, workouts.length - i));
}

/** 1-indexed position of a finished workout among all the user's finished ones. */
export function getWorkoutNumber(userId: string, date: Date) {
  return prisma.workout.count({
    where: { userId, finishedAt: { not: null }, date: { lte: date } },
  });
}

type WorkoutWithSets = Awaited<ReturnType<typeof getActiveWorkout>>;

export function summarizeWorkout(w: NonNullable<WorkoutWithSets>, number?: number) {
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
    number: number ?? null,
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
    recent: workouts
      .slice(0, recentCount)
      .map((w, i) => summarizeWorkout(w, workouts.length - i)),
    weeklyMuscleSets: weeklyMuscleSets(workouts),
  };
}

function add(acc: Totals, e: Totals) {
  acc.workouts += e.workouts;
  acc.sets += e.sets;
  acc.reps += e.reps;
  acc.volume += e.volume;
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardData>>["stats"];

// ---------------------------------------------------------------------------
// Weekly working-set count per muscle group
// ---------------------------------------------------------------------------

/** How many recent training weeks the dashboard grid shows. */
const MUSCLE_WEEKS_SHOWN = 12;

export type WeeklyMuscleSets = {
  /** `yyyy-mm-dd` of each shown week's Sunday, oldest → newest. */
  weeks: string[];
  /** One row per muscle group trained in the window, most-trained first. */
  rows: { muscle: string; counts: number[]; avg: number }[];
  /** All muscle groups combined, per week. */
  totals: { counts: number[]; avg: number };
};

type GridWorkout = {
  date: Date;
  exercises: {
    muscle: string | null;
    exercise: { muscle: string | null } | null;
    sets: { type: string; reps: number; seconds: number | null }[];
  }[];
};

const mean1 = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0;

/**
 * Working sets (warm-ups excluded) each muscle group received, bucketed into the
 * last {@link MUSCLE_WEEKS_SHOWN} weeks that contain a workout. A row's `avg` is
 * the mean over the weeks that muscle was actually trained — weeks it got no
 * sets are left out — so it reads as "sets per session-week for this muscle".
 */
export function weeklyMuscleSets(
  workouts: GridWorkout[],
  weeksShown = MUSCLE_WEEKS_SHOWN,
): WeeklyMuscleSets {
  // weekStart(ms) → muscle → count
  const byWeek = new Map<number, Map<string, number>>();
  for (const w of workouts) {
    const wk = startOfWeek(w.date).getTime();
    const perMuscle = byWeek.get(wk) ?? new Map<string, number>();
    byWeek.set(wk, perMuscle);
    for (const we of w.exercises) {
      const muscle = we.muscle ?? we.exercise?.muscle ?? "Other";
      let n = 0;
      for (const s of we.sets) {
        if (s.type === "WARMUP") continue;
        if (s.reps > 0 || (s.seconds ?? 0) > 0) n += 1;
      }
      if (n > 0) perMuscle.set(muscle, (perMuscle.get(muscle) ?? 0) + n);
    }
  }

  const weekMs = [...byWeek.keys()]
    .sort((a, b) => b - a)
    .slice(0, weeksShown)
    .sort((a, b) => a - b);

  const totalByMuscle = new Map<string, number>();
  for (const ms of weekMs) {
    for (const [muscle, n] of byWeek.get(ms)!) {
      totalByMuscle.set(muscle, (totalByMuscle.get(muscle) ?? 0) + n);
    }
  }
  const order = (m: string) => {
    const i = (MUSCLE_GROUPS as readonly string[]).indexOf(m);
    return i === -1 ? MUSCLE_GROUPS.length : i;
  };
  const muscles = [...totalByMuscle.keys()].sort(
    (a, b) =>
      (totalByMuscle.get(b) ?? 0) - (totalByMuscle.get(a) ?? 0) || order(a) - order(b),
  );

  const rows = muscles.map((muscle) => {
    const counts = weekMs.map((ms) => byWeek.get(ms)!.get(muscle) ?? 0);
    // Average only over the weeks this muscle was trained.
    return { muscle, counts, avg: mean1(counts.filter((c) => c > 0)) };
  });
  const totalsCounts = weekMs.map((ms) =>
    [...byWeek.get(ms)!.values()].reduce((s, x) => s + x, 0),
  );

  return {
    weeks: weekMs.map((ms) => localDateKey(new Date(ms))),
    rows,
    totals: { counts: totalsCounts, avg: mean1(totalsCounts) },
  };
}
