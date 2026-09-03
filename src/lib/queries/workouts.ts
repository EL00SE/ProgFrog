import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  convertWeight,
  isWorkingSet,
  localDateKey,
  MUSCLE_GROUPS,
  type SetLike,
  slotLabel,
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

/**
 * Every finished workout for the user, newest first. Cached per request so the
 * dashboard shell (history pane + scoreboard + muscle grid) scans once.
 */
const finishedWorkouts = cache((userId: string) =>
  prisma.workout.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { date: "desc" },
    include: workoutInclude,
  }),
);

export async function getWorkoutHistory(userId: string) {
  const workouts = await finishedWorkouts(userId);
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
      ...new Set(w.exercises.map((we) => we.exercise?.name ?? slotLabel(we.muscle))),
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
  const workouts = await finishedWorkouts(userId);

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

export type MuscleRow = {
  muscle: string;
  /** Working sets in each shown week, oldest → newest. */
  counts: number[];
  /** Sets ÷ weeks of elapsed training in the block — a true 7-day rate. */
  perWeek: number;
  /** Sets ÷ the number of sessions that actually hit this muscle. */
  perSession: number;
};

export type WeeklyMuscleSets = {
  /** `yyyy-mm-dd` of each shown week's Sunday, oldest → newest. */
  weeks: string[];
  /** Length of the training block the rates are over, in weeks. */
  spanWeeks: number;
  /** One row per muscle group trained in the window, most-trained first. */
  rows: MuscleRow[];
  /** All muscle groups combined. */
  totals: { counts: number[]; perWeek: number; perSession: number };
};

type GridWorkout = {
  date: Date;
  exercises: {
    muscle: string | null;
    exercise: { muscle: string | null } | null;
    sets: { type: string; reps: number; seconds: number | null }[];
  }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Working sets (warm-ups excluded) each muscle group received, over the last
 * {@link MUSCLE_WEEKS_SHOWN} weeks that contain a workout.
 *
 * `perWeek` divides by the elapsed weeks of the training block (first to last
 * workout), not by calendar weeks — so a 6- or 8-day split that drifts against
 * the Sun–Sat boundary still reads as a true weekly rate. `perSession` divides
 * by the number of sessions that hit the muscle, which is the cycle-agnostic
 * unit for a rotating split.
 */
export function weeklyMuscleSets(
  workouts: GridWorkout[],
  weeksShown = MUSCLE_WEEKS_SHOWN,
): WeeklyMuscleSets {
  // Which weeks to show: the most recent `weeksShown` that contain a workout.
  const weeksWithWork = new Set<number>();
  for (const w of workouts) weeksWithWork.add(startOfWeek(w.date).getTime());
  const weekMs = [...weeksWithWork]
    .sort((a, b) => b - a)
    .slice(0, weeksShown)
    .sort((a, b) => a - b);
  const shown = new Set(weekMs);

  const byWeek = new Map<number, Map<string, number>>();
  const totalByMuscle = new Map<string, number>();
  const sessionsByMuscle = new Map<string, number>();
  let firstMs = Infinity;
  let lastMs = -Infinity;
  let sessionCount = 0;

  for (const w of workouts) {
    const wk = startOfWeek(w.date).getTime();
    if (!shown.has(wk)) continue;
    sessionCount += 1;
    firstMs = Math.min(firstMs, w.date.getTime());
    lastMs = Math.max(lastMs, w.date.getTime());
    const perMuscle = byWeek.get(wk) ?? new Map<string, number>();
    byWeek.set(wk, perMuscle);

    // Roll this session's sets up per muscle first, so "sessions that hit it"
    // counts the workout once however many exercises targeted the muscle.
    const thisSession = new Map<string, number>();
    for (const we of w.exercises) {
      const muscle = we.muscle ?? we.exercise?.muscle ?? "Other";
      let n = 0;
      for (const s of we.sets) {
        if (s.type === "WARMUP") continue;
        if (s.reps > 0 || (s.seconds ?? 0) > 0) n += 1;
      }
      if (n > 0) thisSession.set(muscle, (thisSession.get(muscle) ?? 0) + n);
    }
    for (const [muscle, n] of thisSession) {
      perMuscle.set(muscle, (perMuscle.get(muscle) ?? 0) + n);
      totalByMuscle.set(muscle, (totalByMuscle.get(muscle) ?? 0) + n);
      sessionsByMuscle.set(muscle, (sessionsByMuscle.get(muscle) ?? 0) + 1);
    }
  }

  const spanWeeks =
    lastMs > firstMs ? Math.max(1, (lastMs - firstMs) / (7 * 24 * 60 * 60 * 1000)) : 1;

  const order = (m: string) => {
    const i = (MUSCLE_GROUPS as readonly string[]).indexOf(m);
    return i === -1 ? MUSCLE_GROUPS.length : i;
  };
  const muscles = [...totalByMuscle.keys()].sort(
    (a, b) =>
      (totalByMuscle.get(b) ?? 0) - (totalByMuscle.get(a) ?? 0) || order(a) - order(b),
  );

  const rows: MuscleRow[] = muscles.map((muscle) => {
    const counts = weekMs.map((ms) => byWeek.get(ms)?.get(muscle) ?? 0);
    const total = totalByMuscle.get(muscle) ?? 0;
    const sessions = sessionsByMuscle.get(muscle) ?? 0;
    return {
      muscle,
      counts,
      perWeek: round1(total / spanWeeks),
      perSession: sessions ? round1(total / sessions) : 0,
    };
  });

  const totalsCounts = weekMs.map((ms) =>
    [...(byWeek.get(ms)?.values() ?? [])].reduce((s, x) => s + x, 0),
  );
  const grandTotal = totalsCounts.reduce((s, x) => s + x, 0);

  return {
    weeks: weekMs.map((ms) => localDateKey(new Date(ms))),
    spanWeeks: round1(spanWeeks),
    rows,
    totals: {
      counts: totalsCounts,
      perWeek: round1(grandTotal / spanWeeks),
      perSession: sessionCount ? round1(grandTotal / sessionCount) : 0,
    },
  };
}
