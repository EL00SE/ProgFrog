"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const schema = z.object({ weightUnit: z.enum(["KG", "LB"]) });

export async function updateWeightUnit(input: z.infer<typeof schema>) {
  const userId = await getCurrentUserId();
  const { weightUnit } = schema.parse(input);

  await prisma.user.update({ where: { id: userId }, data: { weightUnit } });

  revalidatePath("/dashboard", "layout");
  return { ok: true as const };
}
