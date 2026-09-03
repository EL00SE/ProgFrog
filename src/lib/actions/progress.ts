"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/dal";
import {
  getExerciseProgress,
  getMuscleProgress,
  type ProgressSeries,
} from "@/lib/queries/progress";

const inputSchema = z.object({
  kind: z.enum(["exercise", "muscle"]),
  key: z.string().trim().min(1).max(60),
});

/**
 * Fetch one progress series on demand. The Progress pane stays mounted inside
 * the tab pager, so it can't rely on the route re-rendering when the user picks
 * a different exercise / muscle — it calls this instead. Both underlying queries
 * scope to the caller's own finished workouts.
 */
export async function getProgressSeries(
  kind: "exercise" | "muscle",
  key: string,
): Promise<ProgressSeries | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const parsed = inputSchema.safeParse({ kind, key });
  if (!parsed.success) return null;

  return parsed.data.kind === "muscle"
    ? getMuscleProgress(user.id, parsed.data.key, user.weightUnit)
    : getExerciseProgress(user.id, parsed.data.key, user.weightUnit);
}
