"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { type ExerciseRole, ROLE_VALUES } from "@/lib/training";

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

const roleEnum = z.enum(ROLE_VALUES as [string, ...string[]]);

const workoutExerciseInclude = {
  exercise: true,
  sets: { orderBy: { order: "asc" } },
} as const;

function revalidateWorkoutViews(workoutId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");
  revalidatePath(`/dashboard/workouts/${workoutId}`);
  revalidatePath("/dashboard/progress");
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

  const existing = await prisma.workout.findFirst({
    where: { userId: user.id, finishedAt: null },
    select: { id: true },
  });
  const workout =
    existing ??
    (await prisma.workout.create({
      data: { userId: user.id, name: parsed.name, unit: user.weightUnit },
      select: { id: true },
    }));

  revalidateWorkoutViews(workout.id);
  redirect(`/dashboard/workouts/${workout.id}`);
}

export async function startWorkoutFromTemplateDay(templateDayId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const day = await prisma.templateDay.findFirst({
    where: { id: templateDayId, template: { userId: user.id } },
    include: {
      template: { select: { name: true } },
      exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: {
            select: { equipment: true, muscle: true, role: true, isTimed: true },
          },
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
          role: te.role ?? te.exercise?.role ?? null,
          targetSets: te.targetSets,
          targetReps: te.targetReps,
          order: i,
          equipment: te.exercise?.equipment ?? null,
          supersetGroup: te.supersetGroup,
          sets: {
            create: Array.from({ length: Math.max(te.targetSets ?? 0, 0) }).map(
              (_, s) => ({ order: s }),
            ),
          },
        })),
      },
    },
    select: { id: true },
  });

  revalidateWorkoutViews(workout.id);
  redirect(`/dashboard/workouts/${workout.id}`);
}

export async function finishWorkout(workoutId: string) {
  const userId = await getCurrentUserId();
  await assertOwnWorkout(userId, workoutId);

  // Drop empty exercises so history stays clean.
  await prisma.workoutExercise.deleteMany({
    where: { workoutId, sets: { none: {} } },
  });

  await prisma.workout.update({
    where: { id: workoutId },
    data: { finishedAt: new Date() },
  });

  revalidateWorkoutViews(workoutId);
  redirect("/dashboard");
}

/** Move a finished workout back to in-progress so it can be edited. */
export async function reopenWorkout(workoutId: string) {
  const userId = await getCurrentUserId();
  await assertOwnWorkout(userId, workoutId);
  await prisma.workout.update({
    where: { id: workoutId },
    data: { finishedAt: null },
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
});

export async function updateWorkout(input: z.infer<typeof updateWorkoutSchema>) {
  const userId = await getCurrentUserId();
  const data = updateWorkoutSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

  await prisma.workout.update({
    where: { id: data.workoutId },
    data: {
      name: data.name ?? undefined,
      notes: data.notes ?? undefined,
      date: data.date ? new Date(data.date) : undefined,
    },
  });
  revalidateWorkoutViews(data.workoutId);
  return { ok: true as const };
}

// --- exercises within a workout --------------------------------------------

const addExerciseSchema = z.object({
  workoutId: z.string().min(1),
  exerciseId: z.string().min(1),
  supersetGroup: z.number().int().positive().nullable().optional(),
});

export async function addExerciseToWorkout(input: z.infer<typeof addExerciseSchema>) {
  const userId = await getCurrentUserId();
  const data = addExerciseSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

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
      role: exercise.role,
      order: count,
      equipment: exercise.equipment,
      supersetGroup: data.supersetGroup ?? null,
    },
    include: workoutExerciseInclude,
  });

  revalidateWorkoutViews(data.workoutId);
  return created;
}

const addSlotSchema = z.object({
  workoutId: z.string().min(1),
  muscle: z.string().trim().max(40),
  role: roleEnum,
});

/** Add an exercise-less slot (muscle + role) to fill in later. */
export async function addSlotToWorkout(input: z.infer<typeof addSlotSchema>) {
  const userId = await getCurrentUserId();
  const data = addSlotSchema.parse(input);
  await assertOwnWorkout(userId, data.workoutId);

  const count = await prisma.workoutExercise.count({
    where: { workoutId: data.workoutId },
  });

  const created = await prisma.workoutExercise.create({
    data: {
      workoutId: data.workoutId,
      muscle: data.muscle,
      role: data.role as ExerciseRole,
      order: count,
    },
    include: workoutExerciseInclude,
  });

  revalidateWorkoutViews(data.workoutId);
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
  const workoutId = await assertOwnWorkoutExercise(userId, data.workoutExerciseId);

  const exercise = await prisma.exercise.findFirst({
    where: { id: data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
  });
  if (!exercise) throw new Error("Exercise not available");

  const current = await prisma.workoutExercise.findUnique({
    where: { id: data.workoutExerciseId },
    select: { muscle: true, role: true },
  });

  const updated = await prisma.workoutExercise.update({
    where: { id: data.workoutExerciseId },
    data: {
      exerciseId: exercise.id,
      equipment: exercise.equipment,
      muscle: current?.muscle ?? exercise.muscle,
      role: (current?.role as ExerciseRole | null) ?? exercise.role,
    },
    include: workoutExerciseInclude,
  });

  revalidateWorkoutViews(workoutId);
  return updated;
}

export async function removeWorkoutExercise(workoutExerciseId: string) {
  const userId = await getCurrentUserId();
  const workoutId = await assertOwnWorkoutExercise(userId, workoutExerciseId);
  await prisma.workoutExercise.delete({ where: { id: workoutExerciseId } });
  revalidateWorkoutViews(workoutId);
  return { ok: true as const };
}

const updateWeSchema = z.object({
  workoutExerciseId: z.string().min(1),
  equipment: z.enum(EQUIPMENT).nullable().optional(),
  supersetGroup: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function updateWorkoutExercise(input: z.infer<typeof updateWeSchema>) {
  const userId = await getCurrentUserId();
  const data = updateWeSchema.parse(input);
  const workoutId = await assertOwnWorkoutExercise(userId, data.workoutExerciseId);

  await prisma.workoutExercise.update({
    where: { id: data.workoutExerciseId },
    data: {
      equipment: data.equipment === undefined ? undefined : data.equipment,
      supersetGroup: data.supersetGroup === undefined ? undefined : data.supersetGroup,
      notes: data.notes === undefined ? undefined : data.notes,
    },
  });
  revalidateWorkoutViews(workoutId);
  return { ok: true as const };
}

// --- sets -----------------------------------------------------------------

export async function addSet(workoutExerciseId: string) {
  const userId = await getCurrentUserId();
  const workoutId = await assertOwnWorkoutExercise(userId, workoutExerciseId);

  // Copy the last set's load so repeated sets are one tap.
  const last = await prisma.setEntry.findFirst({
    where: { workoutExerciseId },
    orderBy: { order: "desc" },
  });

  const created = await prisma.setEntry.create({
    data: {
      workoutExerciseId,
      order: last ? last.order + 1 : 0,
      reps: last?.reps ?? 0,
      weight: last?.weight ?? 0,
    },
  });
  revalidateWorkoutViews(workoutId);
  return created;
}

const updateSetSchema = z.object({
  setId: z.string().min(1),
  reps: z.number().int().min(0).max(1000).optional(),
  seconds: z.number().int().min(0).max(36000).nullable().optional(),
  weight: z.number().min(0).max(10000).optional(),
  isDropSet: z.boolean().optional(),
  isWarmup: z.boolean().optional(),
  rpe: z.number().min(0).max(10).nullable().optional(),
});

export async function updateSet(input: z.infer<typeof updateSetSchema>) {
  const userId = await getCurrentUserId();
  const data = updateSetSchema.parse(input);
  const workoutId = await assertOwnSet(userId, data.setId);

  await prisma.setEntry.update({
    where: { id: data.setId },
    data: {
      reps: data.reps,
      seconds: data.seconds === undefined ? undefined : data.seconds,
      weight: data.weight,
      isDropSet: data.isDropSet,
      isWarmup: data.isWarmup,
      rpe: data.rpe === undefined ? undefined : data.rpe,
    },
  });
  revalidateWorkoutViews(workoutId);
  return { ok: true as const };
}

export async function deleteSet(setId: string) {
  const userId = await getCurrentUserId();
  const workoutId = await assertOwnSet(userId, setId);
  await prisma.setEntry.delete({ where: { id: setId } });
  revalidateWorkoutViews(workoutId);
  return { ok: true as const };
}
