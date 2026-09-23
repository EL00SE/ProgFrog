import {
  convertWeight,
  EQUIPMENT_LABELS,
  isCountedSet,
  localDateKey,
  MUSCLE_GROUPS,
  muscleOf,
  SET_TYPE_SHORT,
  type SetType,
  slotLabel,
  startOfWeek,
  type WeightUnit,
} from "@/lib/training";

/**
 * Turns finished workouts into the rows of the spreadsheet export. Pure — no
 * database, no Excel — so what goes in each column can be tested directly.
 * Weights are converted to the user's unit; dates are `yyyy-mm-dd` keys.
 */

export type ExportWorkout = {
  date: Date;
  name: string | null;
  unit: WeightUnit;
  startedAt: Date;
  endedAt: Date | null;
  exercises: {
    muscle: string | null;
    equipment: string | null;
    exercise: { name: string; muscle: string | null; equipment: string } | null;
    sets: {
      type: SetType;
      toFailure: boolean;
      reps: number;
      seconds: number | null;
      weight: number;
    }[];
  }[];
};

/** One logged set — a row of the "Sets" sheet. */
export type SetRow = {
  date: string;
  /** The Sunday that starts the set's week (weeks run Sun–Sat, as on the dashboard). */
  week: string;
  /** The workout's number, oldest = 1 (same as the history list). */
  workout: number;
  workoutName: string;
  exercise: string;
  muscle: string;
  equipment: string;
  /** Position within the exercise, from 1. */
  set: number;
  type: string;
  toFailure: boolean;
  weight: number;
  reps: number;
  seconds: number | null;
  /** Counts toward sets per muscle group — see `isCountedSet`. */
  counted: boolean;
};

/** One finished workout — a row of the "Workouts" sheet. */
export type WorkoutRow = {
  date: string;
  number: number;
  name: string;
  /** Session length, when it was timed. */
  minutes: number | null;
  exercises: number;
  countedSets: number;
  /** Weight × reps over the counted sets, in the export unit. */
  volume: number;
};

export type ExportData = {
  unit: WeightUnit;
  sets: SetRow[];
  workouts: WorkoutRow[];
  /** Every week from the first workout's to the last's — gaps included, as zeros. */
  weeks: string[];
  /** Muscle groups with at least one counted set, in body order. */
  muscles: string[];
  /** Counted sets per week per muscle: `weekly[week][muscle]`. */
  weekly: Record<string, Record<string, number>>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildExport(workouts: ExportWorkout[], unit: WeightUnit): ExportData {
  const ordered = [...workouts].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.startedAt.getTime() - b.startedAt.getTime(),
  );

  const sets: SetRow[] = [];
  const rows: WorkoutRow[] = [];
  const weekly: Record<string, Record<string, number>> = {};
  const trained = new Set<string>();

  ordered.forEach((w, i) => {
    const number = i + 1;
    const date = localDateKey(w.date);
    const week = localDateKey(startOfWeek(w.date));
    const workoutName = w.name ?? "Workout";
    let countedSets = 0;
    let volume = 0;

    for (const we of w.exercises) {
      const muscle = muscleOf(we);
      const equipment = we.equipment ?? we.exercise?.equipment ?? "OTHER";
      we.sets.forEach((s, j) => {
        const counted = isCountedSet(s);
        const weight = round1(convertWeight(s.weight, w.unit, unit));
        sets.push({
          date,
          week,
          workout: number,
          workoutName,
          exercise: we.exercise?.name ?? slotLabel(we.muscle),
          muscle,
          equipment: EQUIPMENT_LABELS[equipment] ?? equipment,
          set: j + 1,
          type: SET_TYPE_SHORT[s.type] ?? s.type,
          toFailure: s.toFailure,
          weight,
          reps: s.reps,
          seconds: s.seconds,
          counted,
        });
        if (!counted) return;
        countedSets += 1;
        volume += weight * s.reps;
        trained.add(muscle);
        const bucket = (weekly[week] ??= {});
        bucket[muscle] = (bucket[muscle] ?? 0) + 1;
      });
    }

    const ms = w.endedAt ? w.endedAt.getTime() - w.startedAt.getTime() : 0;
    rows.push({
      date,
      number,
      name: workoutName,
      minutes: ms > 0 ? Math.round(ms / 60_000) : null,
      exercises: w.exercises.length,
      countedSets,
      volume,
    });
  });

  return {
    unit,
    sets,
    workouts: rows,
    weeks: weekSpan(ordered),
    muscles: bodyOrder([...trained]),
    weekly,
  };
}

/** Each week's Sunday from the first workout's week to the last's. */
function weekSpan(ordered: ExportWorkout[]): string[] {
  if (ordered.length === 0) return [];
  const last = startOfWeek(ordered[ordered.length - 1].date).getTime();
  const out: string[] = [];
  // setDate(+7) steps in local time, so a daylight-saving change can't skew it.
  for (
    let d = startOfWeek(ordered[0].date);
    d.getTime() <= last;
    d.setDate(d.getDate() + 7)
  ) {
    out.push(localDateKey(d));
  }
  return out;
}

/** Muscle groups in the app's head-to-toe order; anything unknown goes last, A–Z. */
function bodyOrder(muscles: string[]): string[] {
  const rank = (m: string) => {
    const i = (MUSCLE_GROUPS as readonly string[]).indexOf(m);
    return i === -1 ? MUSCLE_GROUPS.length : i;
  };
  return muscles.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
