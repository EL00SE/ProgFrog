"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

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

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  equipment: z.enum(EQUIPMENT),
  muscle: z.string().trim().max(40).optional(),
});

const createSchema = exerciseSchema.extend({
  /** idempotency key from the offline outbox */
  clientId: z.string().min(1).max(60).optional(),
});

function revalidateExerciseViews() {
  revalidatePath("/dashboard/exercises");
  revalidatePath("/dashboard/progress");
  // logger and template editors read the catalog
  revalidatePath("/dashboard/workouts", "layout");
  revalidatePath("/dashboard/templates", "layout");
}

export type ExerciseActionResult =
  | {
      ok: true;
      exercise: {
        id: string;
        name: string;
        equipment: string;
        muscle: string | null;
      };
    }
  | { ok: false; error: string };

const exerciseSelect = {
  id: true,
  name: true,
  equipment: true,
  muscle: true,
} as const;

/** Create a private custom exercise for the signed-in user. */
export async function createCustomExercise(
  input: z.infer<typeof createSchema>,
): Promise<ExerciseActionResult> {
  const userId = await getCurrentUserId();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, equipment, muscle, clientId } = parsed.data;

  // Replayed from the offline outbox — hand back what was already created.
  if (clientId) {
    const prior = await prisma.exercise.findUnique({
      where: { clientId },
      select: exerciseSelect,
    });
    if (prior) return { ok: true, exercise: prior };
  }

  const clash = await prisma.exercise.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      OR: [{ ownerId: null }, { ownerId: userId }],
    },
    select: exerciseSelect,
  });
  if (clash) {
    // An outbox replay for a name that now exists resolves to that exercise;
    // an interactive create still tells the user it's a duplicate.
    if (clientId) return { ok: true, exercise: clash };
    return { ok: false, error: `"${name}" already exists in your catalog` };
  }

  const exercise = await prisma.exercise.create({
    data: {
      name,
      equipment,
      muscle: muscle || null,
      ownerId: userId,
      clientId,
    },
    select: exerciseSelect,
  });

  revalidateExerciseViews();
  return { ok: true, exercise };
}

const updateSchema = exerciseSchema.extend({ id: z.string().min(1) });

export async function updateCustomExercise(
  input: z.infer<typeof updateSchema>,
): Promise<ExerciseActionResult> {
  const userId = await getCurrentUserId();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, name, equipment, muscle } = parsed.data;

  const owned = await prisma.exercise.findFirst({
    where: { id, ownerId: userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Exercise not found" };

  const exercise = await prisma.exercise.update({
    where: { id },
    data: {
      name,
      equipment,
      muscle: muscle || null,
    },
    select: exerciseSelect,
  });

  revalidateExerciseViews();
  return { ok: true, exercise };
}

export async function setExerciseArchived(id: string, archived: boolean) {
  const userId = await getCurrentUserId();
  const owned = await prisma.exercise.findFirst({
    where: { id, ownerId: userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Exercise not found");

  await prisma.exercise.update({
    where: { id },
    data: { isArchived: archived },
  });
  revalidateExerciseViews();
  return { ok: true as const };
}
