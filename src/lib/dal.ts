import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Data Access Layer — the single place that checks auth before touching data.
 * See https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
 */

export const getSession = cache(async () => auth());

/** Returns the signed-in user's session, or redirects to sign-in. */
export const requireSession = cache(async () => {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  return session;
});

/** Loads the full user record for the signed-in user (or redirects). */
export const getCurrentUser = cache(async () => {
  const session = await requireSession();
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      weightUnit: true,
      heightCm: true,
      birthday: true,
      chatConsentAt: true,
      createdAt: true,
    },
  });
});

/** The signed-in user's id (or redirects to sign-in). */
export const getCurrentUserId = cache(async () => {
  const session = await requireSession();
  return session.user.id;
});
