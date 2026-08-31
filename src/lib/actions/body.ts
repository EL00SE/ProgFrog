"use server";

import { z } from "zod";

import { getCurrentUser, getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { convertWeight } from "@/lib/training";

// No revalidatePath here: body weight/profile is only shown in <BodyView> on the
// progress page, which keeps its own optimistic state and reconciles on error.

const profileSchema = z.object({
  heightCm: z.number().min(50).max(280).nullable().optional(),
  birthday: z.string().trim().min(1).nullable().optional(),
});

/** Update the (mostly static) body profile: height and birthday. */
export async function updateBodyProfile(input: z.infer<typeof profileSchema>) {
  const userId = await getCurrentUserId();
  const data = profileSchema.parse(input);

  let birthday: Date | null | undefined;
  if (data.birthday !== undefined) {
    if (data.birthday === null) birthday = null;
    else {
      const d = new Date(data.birthday);
      if (Number.isNaN(d.getTime())) throw new Error("Invalid birthday");
      birthday = d;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      heightCm: data.heightCm === undefined ? undefined : data.heightCm,
      birthday: birthday === undefined ? undefined : birthday,
    },
  });

  return { ok: true as const };
}

const logSchema = z.object({
  weight: z.number().positive().max(1000),
  /** unit the `weight` value is given in */
  unit: z.enum(["KG", "LB"]),
  date: z.string().trim().optional(),
  notes: z.string().trim().max(200).optional(),
});

/** Record a body-weight measurement. */
export async function logWeight(input: z.infer<typeof logSchema>) {
  const userId = await getCurrentUserId();
  const data = logSchema.parse(input);

  const entry = await prisma.bodyEntry.create({
    data: {
      userId,
      weightKg: convertWeight(data.weight, data.unit, "KG"),
      date: data.date ? new Date(`${data.date}T12:00:00`) : new Date(),
      notes: data.notes || null,
    },
  });

  return entry;
}

export async function deleteBodyEntry(id: string) {
  const userId = await getCurrentUserId();
  const entry = await prisma.bodyEntry.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!entry) throw new Error("Not found");
  await prisma.bodyEntry.delete({ where: { id } });

  return { ok: true as const };
}

/** Convenience for a settings page: current profile snapshot. */
export async function getBodyProfile() {
  const user = await getCurrentUser();
  return {
    heightCm: user?.heightCm ?? null,
    birthday: user?.birthday ?? null,
    weightUnit: user?.weightUnit ?? "KG",
  };
}
