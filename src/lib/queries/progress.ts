import "server-only";

import { prisma } from "@/lib/prisma";
import {
  best1RM,
  convertWeight,
  type ExerciseRole,
  localDateKey,
  personalRecords,
  roleLabel,
  ROLE_ORDER,
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
      exercise: { select: { id: true, name: true, muscle: true, role: true } },
    },
    distinct: ["exerciseId"],
    orderBy: { exercise: { name: "asc" } },
  });

  const seen = new Map<string, NonNullable<(typeof rows)[number]["exercise"]>>();
  for (const r of rows) if (r.exercise) seen.set(r.exercise.id, r.exercise);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// By role slot
// ---------------------------------------------------------------------------

export type TrackedRole = { key: string; muscle: string; role: string; label: string };

/** Encode/decode a `"<muscle>:<ROLE>"` key for the URL. */
export function roleKey(muscle: string, role: string) {
  return `${muscle}:${role}`;
}
export function parseRoleKey(key: string): { muscle: string; role: string } | null {
  const i = key.lastIndexOf(":");
  if (i < 1) return null;
  return { muscle: key.slice(0, i), role: key.slice(i + 1) };
}

/** (muscle, role) slots the user has logged sets against. */
export async function getTrackedRoles(userId: string): Promise<TrackedRole[]> {
  const rows = await prisma.workoutExercise.findMany({
    where: {
      muscle: { not: null },
      role: { not: null },
      workout: { userId, finishedAt: { not: null } },
      sets: { some: {} },
    },
    select: { muscle: true, role: true },
    distinct: ["muscle", "role"],
  });

  return rows
    .filter((r): r is { muscle: string; role: ExerciseRole } => !!r.muscle && !!r.role)
    .map((r) => ({
      key: roleKey(r.muscle, r.role),
      muscle: r.muscle,
      role: r.role,
      label: roleLabel(r.muscle, r.role),
    }))
    .sort(
      (a, b) =>
        a.muscle.localeCompare(b.muscle) ||
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9),
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

type WhereEntry = { exerciseId: string } | { muscle: string; role: ExerciseRole };

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

export async function getRoleProgress(
  userId: string,
  muscle: string,
  role: string,
  displayUnit: WeightUnit,
): Promise<ProgressSeries | null> {
  if (!(role in ROLE_ORDER)) return null;
  return buildSeries(
    userId,
    roleKey(muscle, role),
    roleLabel(muscle, role),
    { muscle, role: role as ExerciseRole },
    displayUnit,
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
