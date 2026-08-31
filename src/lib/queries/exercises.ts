import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The exercise catalog visible to one user: every global exercise
 * (`ownerId: null`) plus that user's own custom ones. Archived custom
 * exercises are hidden.
 */
export function getExerciseCatalog(userId: string) {
  return prisma.exercise.findMany({
    where: {
      isArchived: false,
      OR: [{ ownerId: null }, { ownerId: userId }],
    },
    orderBy: [{ muscle: "asc" }, { role: "asc" }, { name: "asc" }],
  });
}

/** Just the user's own custom exercises (including archived), for management UI. */
export function getCustomExercises(userId: string) {
  return prisma.exercise.findMany({
    where: { ownerId: userId },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
  });
}

export type CatalogExercise = Awaited<ReturnType<typeof getExerciseCatalog>>[number];
