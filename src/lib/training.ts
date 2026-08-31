/**
 * Pure training-math helpers. No DB, no React — safe to unit test and to import
 * from both server and client components.
 */

export type WeightUnit = "KG" | "LB";

/** Mirrors the `SetType` enum in the Prisma schema. */
export type SetType = "WARMUP" | "NORMAL" | "DROP" | "FAILURE";

export const SET_TYPE_VALUES = ["WARMUP", "NORMAL", "DROP", "FAILURE"] as const;

export const SET_TYPE_LABELS: Record<SetType, string> = {
  WARMUP: "Warm-up set",
  NORMAL: "Normal set",
  DROP: "Drop set",
  FAILURE: "To failure",
};

/** Compact badge form for dense set rows. */
export const SET_TYPE_SHORT: Record<SetType, string> = {
  WARMUP: "Warm-up",
  NORMAL: "Normal",
  DROP: "Drop",
  FAILURE: "Failure",
};

/** Single-letter code for the tightest set rows (always shown with a legend). */
export const SET_TYPE_CODE: Record<SetType, string> = {
  WARMUP: "W",
  NORMAL: "N",
  DROP: "D",
  FAILURE: "F",
};

export const SET_TYPE_HINTS: Record<SetType, string> = {
  WARMUP: "Lighter preparatory set — not counted in volume or personal records.",
  NORMAL: "A straight working set.",
  DROP: "Drop the weight from the set before and rep out again with no rest.",
  FAILURE: "Take this set all the way to muscular failure.",
};

/** A warm-up set is excluded from volume, PR and progress math. */
export function isWorkingSet(s: { type?: SetType | null }): boolean {
  return s.type !== "WARMUP";
}

export type SetLike = {
  reps: number;
  weight: number;
  type?: SetType | null;
};

const LB_PER_KG = 2.2046226218;

/** `yyyy-mm-dd` for a Date in the running environment's local timezone. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight on the Monday of `date`'s week. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Consecutive-week training streak. `weekDates` are workout dates (any order).
 * The streak counts back from the current week; a gap of one week is allowed at
 * the front (so the streak doesn't reset the instant a new week begins).
 */
export function weeklyStreak(weekDates: Date[], now: Date = new Date()): number {
  const weeks = new Set(weekDates.map((d) => startOfWeek(d).getTime()));
  if (weeks.size === 0) return 0;

  const thisWeek = startOfWeek(now).getTime();
  const prevWeek = startOfWeek(new Date(thisWeek - WEEK_MS)).getTime();
  let cursor = weeks.has(thisWeek) ? thisWeek : prevWeek;

  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = startOfWeek(new Date(cursor - WEEK_MS)).getTime();
  }
  return streak;
}

/**
 * Date formatting with a fixed locale so server and client render identically
 * (avoids React hydration mismatches). `value` may be a Date or an ISO string.
 */
export function formatDate(
  value: Date | string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  // Treat a bare yyyy-mm-dd as a local date, not UTC midnight.
  const d =
    typeof value === "string"
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
      : value;
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

/** Convert a weight between units. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "KG" ? value * LB_PER_KG : value / LB_PER_KG;
}

/** Round to a sensible gym increment (0.5) for display. */
export function roundWeight(value: number): number {
  return Math.round(value * 2) / 2;
}

export function formatWeight(value: number, unit: WeightUnit): string {
  const n = roundWeight(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit.toLowerCase()}`;
}

/**
 * Estimated one-rep max (Epley). Returns the weight itself for a single rep and
 * 0 when the set has no load or no reps.
 */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Total volume (weight × reps) for a list of sets, warm-ups excluded. */
export function workoutVolume(sets: SetLike[]): number {
  return sets.filter(isWorkingSet).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

/** Total working reps, warm-ups excluded. */
export function workingReps(sets: SetLike[]): number {
  return sets.filter(isWorkingSet).reduce((sum, s) => sum + s.reps, 0);
}

/** The heaviest working set (ties broken by reps). `null` if there is none. */
export function topSet(sets: SetLike[]): SetLike | null {
  const working = sets.filter((s) => isWorkingSet(s) && s.weight > 0 && s.reps > 0);
  if (working.length === 0) return null;
  return working.reduce((best, s) =>
    s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best,
  );
}

/** Best estimated 1RM across a list of sets. */
export function best1RM(sets: SetLike[]): number {
  return sets
    .filter(isWorkingSet)
    .reduce((best, s) => Math.max(best, epley1RM(s.weight, s.reps)), 0);
}

export type SessionPoint = {
  /** ISO date (yyyy-mm-dd) of the session. */
  date: string;
  best1RM: number;
  topSetWeight: number;
  volume: number;
};

export type PersonalRecords = {
  best1RM: number;
  maxWeight: number;
  bestVolume: number;
  /** date of the session that produced `best1RM` */
  best1RMDate: string | null;
};

/** Roll a chronological list of session points into all-time PRs. */
export function personalRecords(points: SessionPoint[]): PersonalRecords {
  let best1RM = 0;
  let best1RMDate: string | null = null;
  let maxWeight = 0;
  let bestVolume = 0;

  for (const p of points) {
    if (p.best1RM > best1RM) {
      best1RM = p.best1RM;
      best1RMDate = p.date;
    }
    maxWeight = Math.max(maxWeight, p.topSetWeight);
    bestVolume = Math.max(bestVolume, p.volume);
  }

  return { best1RM, maxWeight, bestVolume, best1RMDate };
}

export const EQUIPMENT_LABELS: Record<string, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  MACHINE: "Machine",
  CABLE: "Cable",
  BODYWEIGHT: "Bodyweight",
  KETTLEBELL: "Kettlebell",
  BAND: "Band",
  OTHER: "Other",
};

export const EQUIPMENT_VALUES = Object.keys(EQUIPMENT_LABELS) as string[];

export const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Traps",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Core",
  "Full body",
  "Other",
] as const;

/** `1:30` / `0:45` from a whole number of seconds. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Reads a target-reps string as a number of seconds for timed exercises.
 * Accepts `"60"`, `"60s"`, `"1:00"`. Falls back to 60.
 */
export function parseTargetSeconds(target?: string | null): number {
  if (!target) return 60;
  const t = target.trim();
  const clock = /^(\d+):(\d{1,2})$/.exec(t);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/**
 * How an exercise connects to the next one in the session. Mirrors the
 * `ExerciseLink` enum in the Prisma schema.
 */
export type ExerciseLink = "SUPERSET" | "DROP_SET";

export const LINK_LABELS: Record<ExerciseLink, string> = {
  SUPERSET: "Superset",
  DROP_SET: "Drop set",
};

export const LINK_VALUES = ["SUPERSET", "DROP_SET"] as const;

/** Labels for the "what happens after this exercise" picker. */
export const LINK_OPTION_LABELS = {
  NONE: "Rest after this exercise",
  SUPERSET: "Superset with the next exercise",
  DROP_SET: "Drop set into the next exercise",
} as const;

/** One sentence a beginner can act on, per link type. */
export const LINK_HINTS: Record<ExerciseLink, string> = {
  SUPERSET:
    "Do this and the next exercise back-to-back with no rest, then rest once before repeating.",
  DROP_SET:
    "Go straight into the next exercise with no rest — usually a lighter or easier movement.",
};

export type Linkable = { linkToNext: ExerciseLink | null };

/**
 * Bundle an ordered list of exercises into groups: a run of exercises chained by
 * `linkToNext` becomes one group, everything else stays a group of one. A
 * trailing `linkToNext` on the very last exercise is ignored (nothing follows).
 */
export function groupLinkedExercises<T extends Linkable>(rows: T[]): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  rows.forEach((row, i) => {
    current.push(row);
    const chains = row.linkToNext != null && i < rows.length - 1;
    if (!chains) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Heading for a linked group: "Superset" / "Drop set" when every join is the
 * same type, otherwise "Circuit".
 */
export function linkedGroupLabel(group: Linkable[]): string {
  if (group.length < 2) return "";
  const joins = group.slice(0, -1).map((g) => g.linkToNext);
  return joins.every((j) => j === joins[0])
    ? LINK_LABELS[joins[0] as ExerciseLink]
    : "Circuit";
}

export const ROLE_LABELS = {
  MAIN: "Main lift",
  SECONDARY: "Secondary lift",
  ISOLATION: "Isolation",
  ACCESSORY: "Accessory",
} as const;

export type ExerciseRole = keyof typeof ROLE_LABELS;

export const ROLE_VALUES = Object.keys(ROLE_LABELS) as ExerciseRole[];

export const ROLE_ORDER: Record<string, number> = {
  MAIN: 0,
  SECONDARY: 1,
  ISOLATION: 2,
  ACCESSORY: 3,
};

/** Short badge form, e.g. "Main" / "Secondary" / "Isolation" / "Accessory". */
export function roleShort(role?: string | null): string {
  if (!role) return "";
  return ROLE_LABELS[role as ExerciseRole]?.replace(/ lift$/, "") ?? role;
}

/**
 * Human label for a movement slot: `"Chest · Main lift"`, or just the role, or
 * just the muscle, or `"Exercise"` when neither is known.
 */
export function roleLabel(muscle?: string | null, role?: string | null): string {
  const r = role ? (ROLE_LABELS[role as ExerciseRole] ?? role) : "";
  if (muscle && r) return `${muscle} · ${r}`;
  return muscle || r || "Exercise";
}
