"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  type ExerciseLink,
  LINK_VALUES,
  SET_TYPE_VALUES,
  type SetType,
} from "@/lib/training";

const EQUIPMENT = [
  "BARBELL",
  "DUMBBELL",
  "MACHINE",
  "CABLE",
  "BODYWEIGHT",
  "KETTLEBELL",
  "BAND",
  "OTHER",
] as const;

const linkEnum = z.enum([...LINK_VALUES] as [string, ...string[]]);
const setTypeEnum = z.enum([...SET_TYPE_VALUES] as [string, ...string[]]);

const workoutExerciseInclude = {
  exercise: true,
  sets: { orderBy: { order: "asc" } },
} as const;

function revalidateWorkoutViews(workoutId: string) {
  // "layout" so the dashboard layout's <ActiveWorkoutBar> re-queries too —
  // otherwise a finished workout keeps showing as "in progress".
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/workouts");
  revalidatePath(`/dashboard/workouts/${workoutId}`);
  revalidatePath("/dashboard/progress");
}

/** True once any set in the workout has a real rep count or hold time logged. */
async function hasLoggedSets(workoutId: string): Promise<boolean> {
  const n = await prisma.setEntry.count({
    where: {
      workoutExercise: { workoutId },
      OR: [{ reps: { gt: 0 } }, { seconds: { gt: 0 } }],
    },
  });
  return n > 0;
}

/**
 * Only one workout is open at a time. If the user already has an unfinished
 * workout: return its id when it has real logged data (callers resume it instead
 * of creating a duplicate), otherwise delete the empty scaffold and return null.
 * An empty leftover is exactly what a double-tap on "start" leaves behind.
 */
async function claimOpenWorkout(userId: string): Promise<string | null> {
  const open = await prisma.workout.findFirst({
    where: { userId, finishedAt: null },
    select: { id: true },
  });
  if (!open) return null;

  if (await hasLoggedSets(open.id)) return open.id;

  await prisma.workout.delete({ where: { id: open.id } });
  return null;
}

/**
 * Sweep any *other* open workouts that have nothing logged in them. A rapid
 * double-tap on "start" can create two, and once you finish one the other
 * lingers as a phantom "workout in progress" on the dashboard.
 */
async function sweepEmptyOpenWorkouts(userId: string) {
  const open = await prisma.workout.findMany({
    where: { userId, finishedAt: null },
    select: { id: true },
  });
  for (const w of open) {
    if (!(await hasLoggedSets(w.id))) {
      await prisma.workout.delete({ where: { id: w.id } });
    }
  }
}

/** Confirms the workout exists and belongs to the signed-in user. */
async function assertOwnWorkout(userId: string, workoutId: string) {
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    select: { id: true },
  });
  if (!workout) throw new Error("Workout not found");
}

/** Walks WorkoutExercise -> Workout and checks ownership. */
async function assertOwnWorkoutExercise(userId: string, workoutExerciseId: string) {
  const we = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workout: { userId } },
    select: { workoutId: true },
  });
  if (!we) throw new Error("Exercise not found");
  return we.workoutId;
}

async function assertOwnSet(userId: string, setId: string) {
  const set = await prisma.setEntry.findFirst({
    where: { id: setId, workoutExercise: { workout: { userId } } },
    select: { id: true, workoutExercise: { select: { workoutId: true } } },
  });
  if (!set) throw new Error("Set not found");
  return set.workoutExercise.workoutId;
}

// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().max(80).optional(),
  templateDayId: z.string().trim().min(1).optional(),
});

/** Create today's workout and go to the logger. Reuses an active one if present. */
export async function createWorkout(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = createSchema.parse({
    name: formData.get("name") || undefined,
    templateDayId: formData.get("templateDayId") || undefined,
  });

  if (parsed.templateDayId) {
    return startWorkoutFromTemplateDay(parsed.templateDayId);
  }

  const resume = await claimOpenWorkout(user.id);
  if (resume) {
    revalidateWorkoutViews(resume);
    redirect(`/dashboard/workouts/${resume}`);
  }

  const workout = await prisma.workout.create({
    data: { userId: user.id, name: parsed.name, unit: user.weightUnit },
    select: { id: true },
  });

  revalidateWorkoutViews(workout.id);
  redirect(`/dashboard/workouts/${workout.id}`);
}

export async function startWorkoutFromTemplateDay(templateDayId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Resume an in-progress workout rather than opening a second one.
  const resume = await claimOpenWorkout(user.id);
  if (resume) {
    revalidateWorkoutViews(resume);
    redirect(`/dashboard/workouts/${resume}`);
  }

  const day = await prisma.templateDay.findFirst({
    where: { id: templateDayId, template: { userId: user.id } },
    include: {
      template: { select: { name: true } },
      exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: {
            select: { equipment: true, muscle: true, isTimed: true },
          },
          sets: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!day) throw new Error("Template day not found");

  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      name: `${day.template.name} — ${day.name}`,
      unit: user.weightUnit,
      templateDayId: day.id,
      exercises: {
        create: day.exercises.map((te, i) => ({
          exerciseId: te.exerciseId,
          muscle: te.muscle ?? te.exercise?.muscle ?? null,
          targetSets: te.sets.length || null,
          targetReps: te.targetReps,
          order: i,
          equipment: te.exercise?.equipment ?? null,
          linkToNext: te.linkToNext,
          sets: {
            create: te.sets.map((ts, s) => ({
              order: s,
              type: ts.type,
              targetReps: ts.targetReps ?? te.targetReps,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });

  revalidateWorkoutViews(workout.id);
  redirect(`/dashboard/workouts/${workout.id}`);
}

/** The DB side of finishing, without the redirect — safe to replay from the
 *  offline outbox after a run of queued set writes. */
export async function syncFinishWorkout(workoutId: string) {
  const userId = await getCurrentUserId();
  await assertOwnWorkout(userId, workoutId);

  // Drop empty exercises so history stays clean.
  await prisma.workoutExercise.deleteMany({
    where: { workoutId, sets: { none: {} } },
  });

  const now = new Date();
  await prisma.workout.update({
    where: { id: workoutId },
    data: { finishedAt: now },
  });
  // Stamp the session end time, but don't clobber a value the user has edited.
  await prisma.workout.updateMany({
    where: { id: workoutId, endedAt: null },
    data: { endedAt: now },
  });

  await sweepEmptyOpenWorkouts(userId);

  revalidateWorkoutViews(workoutId);
  return { ok: true as const };
}

export async function finishWorkout(workoutId: string) {
  await syncFinishWorkout(workoutId);
  redirect("/dashboard");
}

/** Move a finished workout back to in-progress so it can be edited. */
export async function reopenWorkout(workoutId: string) {
  const userId = await getCurrentUserId();
  await assertOwnWorkout(userId, workoutId);
  await prisma.workout.update({
    where: { id: workoutId },
    data: { finishedAt: null, endedAt: null },
  });
  revalidateWorkoutViews(workoutId);
  redirect(`/dashboard/workouts/${workoutId}`);
}

export async function deleteWorkout(workoutId: string) {
  const userId = await getCurrentUserId();
  await assertOwnWorkout(userId, workoutId);
  await prisma.workout.delete({ where: { id: workoutId } });
  revalidateWorkoutViews(workoutId);
  redirect("/dashboard/workouts");
}

const updateWorkoutSchema = z.object({
  workoutId: z.string().min(1),
  name: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  date: z.string().optional(),
  startedAt: z.string().datetime({ offset: true }).optional(),
  endedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function updateWorkout(input: z.infer<typeof updateWorkoutSchema>) {
  const userId = await getCurrentUserId();
  const data = updateWorkoutSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

  const startedAt = data.startedAt ? new Date(data.startedAt) : undefined;
  const endedAt =
    data.endedAt === undefined
      ? undefined
      : data.endedAt === null
        ? null
        : new Date(data.endedAt);
  if (startedAt && endedAt && endedAt < startedAt) {
    throw new Error("The session can't end before it starts");
  }

  await prisma.workout.update({
    where: { id: data.workoutId },
    data: {
      name: data.name ?? undefined,
      notes: data.notes ?? undefined,
      date: data.date ? new Date(data.date) : undefined,
      startedAt,
      endedAt,
    },
  });
  revalidateWorkoutViews(data.workoutId);
  return { ok: true as const };
}

// --- exercises within a workout --------------------------------------------

const addExerciseSchema = z.object({
  workoutId: z.string().min(1),
  exerciseId: z.string().min(1),
  linkToNext: linkEnum.nullable().optional(),
  /** idempotency key from the offline outbox */
  clientId: z.string().min(1).max(60).optional(),
});

export async function addExerciseToWorkout(input: z.infer<typeof addExerciseSchema>) {
  const userId = await getCurrentUserId();
  const data = addExerciseSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

  if (data.clientId) {
    const existing = await prisma.workoutExercise.findFirst({
      where: { clientId: data.clientId, workout: { userId } },
      include: workoutExerciseInclude,
    });
    if (existing) return existing; // replayed create — no-op
  }

  const exercise = await prisma.exercise.findFirst({
    where: {
      id: data.exerciseId,
      OR: [{ ownerId: null }, { ownerId: userId }],
    },
  });
  if (!exercise) throw new Error("Exercise not available");

  const count = await prisma.workoutExercise.count({
    where: { workoutId: data.workoutId },
  });

  const created = await prisma.workoutExercise.create({
    data: {
      workoutId: data.workoutId,
      exerciseId: data.exerciseId,
      muscle: exercise.muscle,
      order: count,
      equipment: exercise.equipment,
      linkToNext: (data.linkToNext ?? null) as ExerciseLink | null,
      clientId: data.clientId,
    },
    include: workoutExerciseInclude,
  });

  // No revalidate — the logger owns its state; see updateSet().
  return created;
}

const addSlotSchema = z.object({
  workoutId: z.string().min(1),
  muscle: z.string().trim().max(40),
  clientId: z.string().min(1).max(60).optional(),
});

/** Add an exercise-less slot (a muscle group) to fill in later. */
export async function addSlotToWorkout(input: z.infer<typeof addSlotSchema>) {
  const userId = await getCurrentUserId();
  const data = addSlotSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

  if (data.clientId) {
    const existing = await prisma.workoutExercise.findFirst({
      where: { clientId: data.clientId, workout: { userId } },
      include: workoutExerciseInclude,
    });
    if (existing) return existing;
  }

  const count = await prisma.workoutExercise.count({
    where: { workoutId: data.workoutId },
  });

  const created = await prisma.workoutExercise.create({
    data: {
      workoutId: data.workoutId,
      muscle: data.muscle,
      order: count,
      clientId: data.clientId,
    },
    include: workoutExerciseInclude,
  });

  // No revalidate — the logger owns its state; see updateSet().
  return created;
}

const assignSchema = z.object({
  workoutExerciseId: z.string().min(1),
  exerciseId: z.string().min(1),
});

/** Fill or swap the specific exercise on a workout slot. */
export async function assignWorkoutEntryExercise(input: z.infer<typeof assignSchema>) {
  const userId = await getCurrentUserId();
  const data = assignSchema.parse(input);
  await assertOwnWorkoutExercise(userId, data.workoutExerciseId);

  const exercise = await prisma.exercise.findFirst({
    where: { id: data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
  });
  if (!exercise) throw new Error("Exercise not available");

  const current = await prisma.workoutExercise.findUnique({
    where: { id: data.workoutExerciseId },
    select: { muscle: true },
  });

  const updated = await prisma.workoutExercise.update({
    where: { id: data.workoutExerciseId },
    data: {
      exerciseId: exercise.id,
      equipment: exercise.equipment,
      muscle: current?.muscle ?? exercise.muscle,
    },
    include: workoutExerciseInclude,
  });

  // No revalidate — the logger owns its state; see updateSet().
  return updated;
}

export async function removeWorkoutExercise(workoutExerciseId: string) {
  const userId = await getCurrentUserId();
  // deleteMany (not delete) so a replayed removal after it's already gone no-ops.
  await prisma.workoutExercise.deleteMany({
    where: { id: workoutExerciseId, workout: { userId } },
  });
  // No revalidate — the logger owns its state; see updateSet().
  return { ok: true as const };
}

const reorderExercisesSchema = z.object({
  workoutId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

/** Persist a new exercise order for an in-progress workout. */
export async function reorderWorkoutExercises(
  input: z.infer<typeof reorderExercisesSchema>,
) {
  const userId = await getCurrentUserId();
  const data = reorderExercisesSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

  const owned = await prisma.workoutExercise.findMany({
    where: { workoutId: data.workoutId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((e) => e.id));
  // Apply the order for whatever we still own — an id may have been removed
  // between the reorder being queued offline and this replay.
  const ordered = data.orderedIds.filter((id) => ownedIds.has(id));
  if (ordered.length === 0) return { ok: true as const };

  await prisma.$transaction(
    ordered.map((id, order) =>
      prisma.workoutExercise.update({ where: { id }, data: { order } }),
    ),
  );
  // No revalidate — the logger owns its state; see updateSet().
  return { ok: true as const };
}

const updateWeSchema = z.object({
  workoutExerciseId: z.string().min(1),
  equipment: z.enum(EQUIPMENT).nullable().optional(),
  linkToNext: linkEnum.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function updateWorkoutExercise(input: z.infer<typeof updateWeSchema>) {
  const userId = await getCurrentUserId();
  const data = updateWeSchema.parse(input);
  await assertOwnWorkoutExercise(userId, data.workoutExerciseId);

  await prisma.workoutExercise.update({
    where: { id: data.workoutExerciseId },
    data: {
      equipment: data.equipment === undefined ? undefined : data.equipment,
      linkToNext:
        data.linkToNext === undefined
          ? undefined
          : (data.linkToNext as ExerciseLink | null),
      notes: data.notes === undefined ? undefined : data.notes,
    },
  });
  // No revalidate — see updateSet().
  return { ok: true as const };
}

// --- sets -----------------------------------------------------------------

const addSetSchema = z.object({
  workoutExerciseId: z.string().min(1),
  type: setTypeEnum.optional(),
  clientId: z.string().min(1).max(60).optional(),
});

export async function addSet(
  workoutExerciseIdInput: string,
  opts?: { type?: SetType; clientId?: string },
) {
  const userId = await getCurrentUserId();
  const {
    workoutExerciseId,
    type: parsedType,
    clientId,
  } = addSetSchema.parse({ workoutExerciseId: workoutExerciseIdInput, ...opts });

  if (clientId) {
    const existing = await prisma.setEntry.findFirst({
      where: { clientId, workoutExercise: { workout: { userId } } },
    });
    if (existing) return existing; // replayed create — no-op
  }

  const we = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workout: { userId } },
    select: { exerciseId: true },
  });
  if (!we) throw new Error("Exercise not found");

  // Copy the last set's load so repeated sets are one tap.
  const last = await prisma.setEntry.findFirst({
    where: { workoutExerciseId },
    orderBy: { order: "desc" },
  });

  // First set of this exercise today — seed from the last time it was trained
  // so the picker opens near a sensible load instead of at zero.
  let seedWeight = last?.weight ?? 0;
  let seedReps = last?.reps ?? 0;
  if (!last && we.exerciseId) {
    const prevSet = await prisma.setEntry.findFirst({
      where: {
        type: { not: "WARMUP" },
        reps: { gt: 0 },
        workoutExercise: {
          exerciseId: we.exerciseId,
          workout: { userId, finishedAt: { not: null } },
        },
      },
      orderBy: [{ workoutExercise: { workout: { date: "desc" } } }, { order: "desc" }],
    });
    if (prevSet) {
      seedWeight = prevSet.weight;
      seedReps = prevSet.reps;
    }
  }

  const type = (parsedType ?? "NORMAL") as SetType;
  // A drop set is lighter by definition — start it ~20% down (nearest 0.5) so
  // the intent is obvious; the user still adjusts.
  const weight =
    type === "DROP" && seedWeight > 0
      ? Math.max(0, Math.round(seedWeight * 0.8 * 2) / 2)
      : seedWeight;

  const created = await prisma.setEntry.create({
    data: {
      workoutExerciseId,
      order: last ? last.order + 1 : 0,
      type,
      reps: seedReps,
      weight,
      clientId,
    },
  });
  // No revalidate — the logger owns its state; see updateSet().
  return created;
}

const updateSetSchema = z.object({
  setId: z.string().min(1),
  type: setTypeEnum.optional(),
  reps: z.number().int().min(0).max(1000).optional(),
  seconds: z.number().int().min(0).max(36000).nullable().optional(),
  weight: z.number().min(0).max(10000).optional(),
  rpe: z.number().min(0).max(10).nullable().optional(),
});

export async function updateSet(input: z.infer<typeof updateSetSchema>) {
  const userId = await getCurrentUserId();
  const data = updateSetSchema.parse(input);
  await assertOwnSet(userId, data.setId);

  await prisma.setEntry.update({
    where: { id: data.setId },
    data: {
      type: data.type === undefined ? undefined : (data.type as SetType),
      reps: data.reps,
      seconds: data.seconds === undefined ? undefined : data.seconds,
      weight: data.weight,
      rpe: data.rpe === undefined ? undefined : data.rpe,
    },
  });
  // No revalidate: an in-progress workout isn't shown on any other page, and the
  // logger keeps its own state. finishWorkout() refreshes everything.
  return { ok: true as const };
}

export async function deleteSet(setId: string) {
  const userId = await getCurrentUserId();
  // deleteMany so a replayed delete after it's already gone no-ops.
  await prisma.setEntry.deleteMany({
    where: { id: setId, workoutExercise: { workout: { userId } } },
  });
  // No revalidate — the logger owns its state; see updateSet().
  return { ok: true as const };
}
