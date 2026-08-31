"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserId } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Record that the user agreed to let the training assistant read their data. */
export async function grantChatConsent() {
  const userId = await getCurrentUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { chatConsentAt: new Date() },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true as const };
}
