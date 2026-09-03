"use server";

import { getCurrentUser } from "@/lib/dal";
import {
  getExerciseProgress,
  getMuscleProgress,
  type ProgressSeries,
} from "@/lib/queries/progress";

/**
 * Fetch one progress series on demand. The Progress pane stays mounted inside
 * the tab pager, so it can't rely on the route re-rendering when the user picks
 * a different exercise / muscle — it calls this instead.
 */
export async function getProgressSeries(
  kind: "exercise" | "muscle",
  key: string,
): Promise<ProgressSeries | null> {
  const user = await getCurrentUser();
  if (!user || !key) return null;
  return kind === "muscle"
    ? getMuscleProgress(user.id, key, user.weightUnit)
    : getExerciseProgress(user.id, key, user.weightUnit);
}
