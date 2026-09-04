"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  type ExerciseLink,
  isWorkingSet,
  LINK_VALUES,
  SET_TYPE_VALUES,
  type SetType,
} from "@/lib/training";

const linkEnum = z.enum([...LINK_VALUES] as [string, ...string[]]);
const setTypeEnum = z.enum([...SET_TYPE_VALUES] as [string, ...string[]]);

function revalidateTemplateViews(templateId?: string) {
  // "layout" so the Templates pane (rendered by dashboard/layout.tsx) refreshes.
  revalidatePath("/dashboard", "layout");
  if (templateId) revalidatePath(`/dashboard/templates/${templateId}`);
}

/**
 * For edits made inside the editor: the editor keeps its own optimistic state
 * and ignores prop updates, so re-fetching the `[id]` route is wasted work that
 * only drags out the "saving…" indicator. Just keep the list (day/slot counts)
 * fresh for when the user navigates back to it.
 */
function revalidateTemplateList() {
  revalidatePath("/dashboard", "layout");
}

async function assertOwnTemplate(userId: string, templateId: string) {
  const t = await prisma.template.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });
  if (!t) throw new Error("Template not found");
}

async function assertOwnDay(userId: string, dayId: string) {
  const d = await prisma.templateDay.findFirst({
    where: { id: dayId, template: { userId } },
    select: { templateId: true },
  });
  if (!d) throw new Error("Template day not found");
  return d.templateId;
}

async function assertOwnTemplateExercise(userId: string, id: string) {
  const te = await prisma.templateExercise.findFirst({
    where: { id, templateDay: { template: { userId } } },
    select: { templateDay: { select: { templateId: true } } },
  });
  if (!te) throw new Error("Not found");
  return te.templateDay.templateId;
}

async function assertOwnTemplateSet(userId: string, id: string) {
  const ts = await prisma.templateSet.findFirst({
    where: { id, templateExercise: { templateDay: { template: { userId } } } },
    select: {
      templateExerciseId: true,
      templateExercise: {
        select: { templateDay: { select: { templateId: true } } },
      },
    },
  });
  if (!ts) throw new Error("Not found");
  return {
    templateExerciseId: ts.templateExerciseId,
    templateId: ts.templateExercise.templateDay.templateId,
  };
}

// --- add a finished workout to a template -------------------------------

const addWorkoutSchema = z
  .object({
    workoutId: z.string().min(1),
    /** an existing template, or null to spin up a new one named `newTemplateName` */
    templateId: z.string().min(1).nullable(),
    newTemplateName: z.string().trim().min(1).max(80).optional(),
    /** an existing day, or null to create a fresh day from the workout */
    dayId: z.string().min(1).nullable(),
    /** "exercise" keeps the specific movements; "slot" keeps only the muscle group */
    mode: z.enum(["exercise", "slot"]),
  })
  .refine((d) => d.templateId || d.newTemplateName, {
    message: "Pick a template or name a new one",
  });

/** "3 × 8" style rep target derived from a workout exercise's working sets. */
function repTarget(reps: number[]): string | null {
  const r = reps.filter((n) => n > 0);
  if (!r.length) return null;
  const lo = Math.min(...r);
  const hi = Math.max(...r);
  return lo === hi ? String(lo) : `${lo}-${hi}`;
}

export async function addWorkoutToTemplate(input: z.infer<typeof addWorkoutSchema>) {
  const userId = await getCurrentUserId();
  const data = addWorkoutSchema.parse(input);

  const workout = await prisma.workout.findFirst({
    where: { id: data.workoutId, userId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { select: { muscle: true } }, sets: true },
      },
    },
  });
  if (!workout) throw new Error("Workout not found");

  // Existing template, or create one on the spot.
  let templateId = data.templateId;
  if (templateId) {
    await assertOwnTemplate(userId, templateId);
  } else {
    const created = await prisma.template.create({
      data: { userId, name: data.newTemplateName!.trim() },
      select: { id: true },
    });
    templateId = created.id;
  }

  let dayId = data.dayId;
  if (dayId) {
    const owning = await assertOwnDay(userId, dayId);
    if (owning !== templateId) throw new Error("That day belongs to another template");
  } else {
    const count = await prisma.templateDay.count({ where: { templateId } });
    const day = await prisma.templateDay.create({
      data: {
        templateId,
        name: (workout.name?.split("·").pop() ?? "").trim() || `Day ${count + 1}`,
        order: count,
      },
    });
    dayId = day.id;
  }

  const start = await prisma.templateExercise.count({
    where: { templateDayId: dayId },
  });

  await prisma.$transaction(
    workout.exercises.map((we, i) => {
      const working = we.sets.filter(
        (s) => isWorkingSet(s) && (s.reps > 0 || (s.seconds ?? 0) > 0),
      );
      const keepExercise = data.mode === "exercise" && !!we.exerciseId;
      return prisma.templateExercise.create({
        data: {
          templateDayId: dayId!,
          exerciseId: keepExercise ? we.exerciseId : null,
          muscle: we.muscle ?? we.exercise?.muscle ?? "Other",
          order: start + i,
          targetReps: repTarget(working.map((s) => s.reps)),
          linkToNext: we.linkToNext,
          sets: {
            create: Array.from({ length: Math.max(working.length, 1) }, (_, s) => ({
              order: s,
              type: "NORMAL" as const,
            })),
          },
        },
      });
    }),
  );

  revalidateTemplateViews(templateId);
  return { ok: true as const, templateId, dayId };
}

// --- template -------------------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional(),
});

export async function createTemplate(formData: FormData) {
  const userId = await getCurrentUserId();
  const { name, description } = createSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const template = await prisma.template.create({
    data: {
      userId,
      name,
      description: description || null,
      days: { create: { name: "Day 1", order: 0 } },
    },
    select: { id: true },
  });

  revalidateTemplateViews(template.id);
  redirect(`/dashboard/templates/${template.id}`);
}

const updateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function updateTemplate(input: z.infer<typeof updateSchema>) {
  const userId = await getCurrentUserId();
  const data = updateSchema.parse(input);
  await assertOwnTemplate(userId, data.templateId);

  await prisma.template.update({
    where: { id: data.templateId },
    data: {
      name: data.name,
      description: data.description === undefined ? undefined : data.description,
    },
  });
  revalidateTemplateList();
  return { ok: true as const };
}

export async function deleteTemplate(templateId: string) {
  const userId = await getCurrentUserId();
  await assertOwnTemplate(userId, templateId);
  await prisma.template.delete({ where: { id: templateId } });
  revalidateTemplateViews();
  redirect("/dashboard/templates");
}

// --- days ----------------------------------------------------------------

export async function addTemplateDay(templateId: string) {
  const userId = await getCurrentUserId();
  await assertOwnTemplate(userId, templateId);
  const count = await prisma.templateDay.count({ where: { templateId } });
  const day = await prisma.templateDay.create({
    data: { templateId, name: `Day ${count + 1}`, order: count },
    include: { exercises: { include: { exercise: true, sets: true } } },
  });
  revalidateTemplateList();
  return day;
}

const reorderDaysSchema = z.object({
  templateId: z.string().min(1),
  dayIds: z.array(z.string().min(1)).min(1).max(60),
});

/** Persist a new day order (ids given in the desired order). */
export async function reorderTemplateDays(input: z.infer<typeof reorderDaysSchema>) {
  const userId = await getCurrentUserId();
  const { templateId, dayIds } = reorderDaysSchema.parse(input);
  await assertOwnTemplate(userId, templateId);

  const owned = new Set(
    (
      await prisma.templateDay.findMany({
        where: { templateId },
        select: { id: true },
      })
    ).map((d) => d.id),
  );
  const ordered = dayIds.filter((id) => owned.has(id));
  await prisma.$transaction(
    ordered.map((id, i) =>
      prisma.templateDay.update({ where: { id }, data: { order: i } }),
    ),
  );
  revalidateTemplateList();
  return { ok: true as const };
}

const renameDaySchema = z.object({
  dayId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

export async function renameTemplateDay(input: z.infer<typeof renameDaySchema>) {
  const userId = await getCurrentUserId();
  const { dayId, name } = renameDaySchema.parse(input);
  await assertOwnDay(userId, dayId);
  await prisma.templateDay.update({ where: { id: dayId }, data: { name } });
  revalidateTemplateList();
  return { ok: true as const };
}

export async function removeTemplateDay(dayId: string) {
  const userId = await getCurrentUserId();
  await assertOwnDay(userId, dayId);
  await prisma.templateDay.delete({ where: { id: dayId } });
  revalidateTemplateList();
  return { ok: true as const };
}

/** Clone a day (name, exercise slots, their planned sets) as a new day. */
export async function duplicateTemplateDay(dayId: string) {
  const userId = await getCurrentUserId();
  const source = await prisma.templateDay.findFirst({
    where: { id: dayId, template: { userId } },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: true,
          sets: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!source) throw new Error("Template day not found");

  const count = await prisma.templateDay.count({
    where: { templateId: source.templateId },
  });

  const day = await prisma.templateDay.create({
    data: {
      templateId: source.templateId,
      name: `${source.name} (copy)`.slice(0, 40),
      order: count,
      exercises: {
        create: source.exercises.map((te) => ({
          exerciseId: te.exerciseId,
          muscle: te.muscle,
          order: te.order,
          targetReps: te.targetReps,
          linkToNext: te.linkToNext,
          sets: {
            create: te.sets.map((ts) => ({
              order: ts.order,
              type: ts.type,
              targetReps: ts.targetReps,
            })),
          },
        })),
      },
    },
    include: { exercises: { include: { exercise: true, sets: true } } },
  });

  revalidateTemplateList();
  return day;
}

// --- exercises within a day --------------------------------------------

const addExerciseSchema = z
  .object({
    dayId: z.string().min(1),
    exerciseId: z.string().min(1).optional(),
    muscle: z.string().trim().max(40).optional(),
    targetSets: z.number().int().min(1).max(20).optional(),
    targetReps: z.string().trim().max(20).optional(),
    linkToNext: linkEnum.nullable().optional(),
  })
  .refine((d) => d.exerciseId || d.muscle, {
    message: "Pick an exercise or a muscle group",
  });

/** Add a slot to a template day — either a specific exercise or an open muscle group. */
export async function addTemplateExercise(input: z.infer<typeof addExerciseSchema>) {
  const userId = await getCurrentUserId();
  const data = addExerciseSchema.parse(input);
  await assertOwnDay(userId, data.dayId);

  let muscle = data.muscle ?? null;

  if (data.exerciseId) {
    const exercise = await prisma.exercise.findFirst({
      where: { id: data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { muscle: true },
    });
    if (!exercise) throw new Error("Exercise not available");
    muscle = muscle ?? exercise.muscle;
  }

  const count = await prisma.templateExercise.count({
    where: { templateDayId: data.dayId },
  });
  const setCount = data.targetSets ?? 3;
  const created = await prisma.templateExercise.create({
    data: {
      templateDayId: data.dayId,
      exerciseId: data.exerciseId ?? null,
      muscle,
      order: count,
      targetReps: data.targetReps || "8-12",
      linkToNext: (data.linkToNext ?? null) as ExerciseLink | null,
      sets: {
        create: Array.from({ length: setCount }, (_, i) => ({
          order: i,
          type: "NORMAL" as const,
        })),
      },
    },
    include: { exercise: true, sets: { orderBy: { order: "asc" } } },
  });
  revalidateTemplateList();
  return created;
}

const updateExerciseSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1).nullable().optional(),
  muscle: z.string().trim().max(40).nullable().optional(),
  targetReps: z.string().trim().max(20).nullable().optional(),
  linkToNext: linkEnum.nullable().optional(),
});

export async function updateTemplateExercise(
  input: z.infer<typeof updateExerciseSchema>,
) {
  const userId = await getCurrentUserId();
  const data = updateExerciseSchema.parse(input);
  await assertOwnTemplateExercise(userId, data.id);

  // Setting a specific exercise adopts its muscle when the slot has none.
  let muscle = data.muscle;
  if (data.exerciseId) {
    const exercise = await prisma.exercise.findFirst({
      where: { id: data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { muscle: true },
    });
    if (!exercise) throw new Error("Exercise not available");
    const current = await prisma.templateExercise.findUnique({
      where: { id: data.id },
      select: { muscle: true },
    });
    muscle = muscle ?? current?.muscle ?? exercise.muscle;
  }

  await prisma.templateExercise.update({
    where: { id: data.id },
    data: {
      exerciseId: data.exerciseId === undefined ? undefined : data.exerciseId,
      muscle: muscle === undefined ? undefined : muscle,
      targetReps: data.targetReps === undefined ? undefined : data.targetReps,
      linkToNext:
        data.linkToNext === undefined
          ? undefined
          : (data.linkToNext as ExerciseLink | null),
    },
  });
  revalidateTemplateList();
  return { ok: true as const };
}

export async function removeTemplateExercise(id: string) {
  const userId = await getCurrentUserId();
  await assertOwnTemplateExercise(userId, id);
  await prisma.templateExercise.delete({ where: { id } });
  revalidateTemplateList();
  return { ok: true as const };
}

const reorderExercisesSchema = z.object({
  dayId: z.string().min(1),
  exerciseIds: z.array(z.string().min(1)).min(1).max(60),
});

/** Persist a new exercise order within one day. */
export async function reorderTemplateExercises(
  input: z.infer<typeof reorderExercisesSchema>,
) {
  const userId = await getCurrentUserId();
  const { dayId, exerciseIds } = reorderExercisesSchema.parse(input);
  await assertOwnDay(userId, dayId);

  const owned = new Set(
    (
      await prisma.templateExercise.findMany({
        where: { templateDayId: dayId },
        select: { id: true },
      })
    ).map((e) => e.id),
  );
  const ordered = exerciseIds.filter((id) => owned.has(id));
  await prisma.$transaction(
    ordered.map((id, i) =>
      prisma.templateExercise.update({ where: { id }, data: { order: i } }),
    ),
  );
  revalidateTemplateList();
  return { ok: true as const };
}

// --- planned sets within a template slot ----------------------------------

/** Append a planned set to a template slot, copying the last set's type. */
export async function addTemplateSet(templateExerciseId: string) {
  const userId = await getCurrentUserId();
  await assertOwnTemplateExercise(userId, templateExerciseId);
  const last = await prisma.templateSet.findFirst({
    where: { templateExerciseId },
    orderBy: { order: "desc" },
  });
  const created = await prisma.templateSet.create({
    data: {
      templateExerciseId,
      order: last ? last.order + 1 : 0,
      type: last?.type ?? "NORMAL",
    },
  });
  revalidateTemplateList();
  return created;
}

const updateSetSchema = z.object({
  id: z.string().min(1),
  type: setTypeEnum.optional(),
  targetReps: z.string().trim().max(20).nullable().optional(),
});

export async function updateTemplateSet(input: z.infer<typeof updateSetSchema>) {
  const userId = await getCurrentUserId();
  const data = updateSetSchema.parse(input);
  await assertOwnTemplateSet(userId, data.id);
  await prisma.templateSet.update({
    where: { id: data.id },
    data: {
      type: data.type === undefined ? undefined : (data.type as SetType),
      targetReps: data.targetReps === undefined ? undefined : data.targetReps,
    },
  });
  revalidateTemplateList();
  return { ok: true as const };
}

export async function removeTemplateSet(id: string) {
  const userId = await getCurrentUserId();
  await assertOwnTemplateSet(userId, id);
  await prisma.templateSet.delete({ where: { id } });
  revalidateTemplateList();
  return { ok: true as const };
}
