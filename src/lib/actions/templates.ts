"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  type ExerciseLink,
  type ExerciseRole,
  LINK_VALUES,
  ROLE_VALUES,
  SET_TYPE_VALUES,
  type SetType,
} from "@/lib/training";

const roleEnum = z.enum(ROLE_VALUES as [string, ...string[]]);
const linkEnum = z.enum([...LINK_VALUES] as [string, ...string[]]);
const setTypeEnum = z.enum([...SET_TYPE_VALUES] as [string, ...string[]]);

function revalidateTemplateViews(templateId?: string) {
  revalidatePath("/dashboard/templates");
  if (templateId) revalidatePath(`/dashboard/templates/${templateId}`);
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
  revalidateTemplateViews(data.templateId);
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
  await prisma.templateDay.create({
    data: { templateId, name: `Day ${count + 1}`, order: count },
  });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

const renameDaySchema = z.object({
  dayId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
});

export async function renameTemplateDay(input: z.infer<typeof renameDaySchema>) {
  const userId = await getCurrentUserId();
  const { dayId, name } = renameDaySchema.parse(input);
  const templateId = await assertOwnDay(userId, dayId);
  await prisma.templateDay.update({ where: { id: dayId }, data: { name } });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

export async function removeTemplateDay(dayId: string) {
  const userId = await getCurrentUserId();
  const templateId = await assertOwnDay(userId, dayId);
  await prisma.templateDay.delete({ where: { id: dayId } });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

// --- exercises within a day --------------------------------------------

const addExerciseSchema = z
  .object({
    dayId: z.string().min(1),
    exerciseId: z.string().min(1).optional(),
    muscle: z.string().trim().max(40).optional(),
    role: roleEnum.optional(),
    targetSets: z.number().int().min(1).max(20).optional(),
    targetReps: z.string().trim().max(20).optional(),
    linkToNext: linkEnum.nullable().optional(),
  })
  .refine((d) => d.exerciseId || (d.muscle && d.role), {
    message: "Pick an exercise, or a muscle and role",
  });

/** Add a slot to a template day — either a specific exercise or an open muscle/role. */
export async function addTemplateExercise(input: z.infer<typeof addExerciseSchema>) {
  const userId = await getCurrentUserId();
  const data = addExerciseSchema.parse(input);
  const templateId = await assertOwnDay(userId, data.dayId);

  let muscle = data.muscle ?? null;
  let role = (data.role ?? null) as ExerciseRole | null;

  if (data.exerciseId) {
    const exercise = await prisma.exercise.findFirst({
      where: { id: data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { muscle: true, role: true },
    });
    if (!exercise) throw new Error("Exercise not available");
    muscle = muscle ?? exercise.muscle;
    role = role ?? exercise.role;
  }

  const count = await prisma.templateExercise.count({
    where: { templateDayId: data.dayId },
  });
  const setCount = data.targetSets ?? 3;
  await prisma.templateExercise.create({
    data: {
      templateDayId: data.dayId,
      exerciseId: data.exerciseId ?? null,
      muscle,
      role,
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
  });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

const updateExerciseSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1).nullable().optional(),
  muscle: z.string().trim().max(40).nullable().optional(),
  role: roleEnum.nullable().optional(),
  targetReps: z.string().trim().max(20).nullable().optional(),
  linkToNext: linkEnum.nullable().optional(),
});

export async function updateTemplateExercise(
  input: z.infer<typeof updateExerciseSchema>,
) {
  const userId = await getCurrentUserId();
  const data = updateExerciseSchema.parse(input);
  const templateId = await assertOwnTemplateExercise(userId, data.id);

  // Setting a specific exercise adopts its muscle/role when the slot has none.
  let muscle = data.muscle;
  let role = data.role as ExerciseRole | null | undefined;
  if (data.exerciseId) {
    const exercise = await prisma.exercise.findFirst({
      where: { id: data.exerciseId, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { muscle: true, role: true },
    });
    if (!exercise) throw new Error("Exercise not available");
    const current = await prisma.templateExercise.findUnique({
      where: { id: data.id },
      select: { muscle: true, role: true },
    });
    muscle = muscle ?? current?.muscle ?? exercise.muscle;
    role = role ?? (current?.role as ExerciseRole | null) ?? exercise.role;
  }

  await prisma.templateExercise.update({
    where: { id: data.id },
    data: {
      exerciseId: data.exerciseId === undefined ? undefined : data.exerciseId,
      muscle: muscle === undefined ? undefined : muscle,
      role: role === undefined ? undefined : role,
      targetReps: data.targetReps === undefined ? undefined : data.targetReps,
      linkToNext:
        data.linkToNext === undefined
          ? undefined
          : (data.linkToNext as ExerciseLink | null),
    },
  });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

export async function removeTemplateExercise(id: string) {
  const userId = await getCurrentUserId();
  const templateId = await assertOwnTemplateExercise(userId, id);
  await prisma.templateExercise.delete({ where: { id } });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

// --- planned sets within a template slot ----------------------------------

/** Append a planned set to a template slot, copying the last set's type. */
export async function addTemplateSet(templateExerciseId: string) {
  const userId = await getCurrentUserId();
  const templateId = await assertOwnTemplateExercise(userId, templateExerciseId);
  const last = await prisma.templateSet.findFirst({
    where: { templateExerciseId },
    orderBy: { order: "desc" },
  });
  await prisma.templateSet.create({
    data: {
      templateExerciseId,
      order: last ? last.order + 1 : 0,
      type: last?.type ?? "NORMAL",
    },
  });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

const updateSetSchema = z.object({
  id: z.string().min(1),
  type: setTypeEnum.optional(),
  targetReps: z.string().trim().max(20).nullable().optional(),
});

export async function updateTemplateSet(input: z.infer<typeof updateSetSchema>) {
  const userId = await getCurrentUserId();
  const data = updateSetSchema.parse(input);
  const { templateId } = await assertOwnTemplateSet(userId, data.id);
  await prisma.templateSet.update({
    where: { id: data.id },
    data: {
      type: data.type === undefined ? undefined : (data.type as SetType),
      targetReps: data.targetReps === undefined ? undefined : data.targetReps,
    },
  });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}

export async function removeTemplateSet(id: string) {
  const userId = await getCurrentUserId();
  const { templateId } = await assertOwnTemplateSet(userId, id);
  await prisma.templateSet.delete({ where: { id } });
  revalidateTemplateViews(templateId);
  return { ok: true as const };
}
