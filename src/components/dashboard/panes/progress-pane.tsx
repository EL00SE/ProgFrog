import type { WeightUnit } from "@/lib/training";
import { getBodyData } from "@/lib/queries/body";
import {
  getExerciseProgress,
  getMuscleProgress,
  getTrackedExercises,
  getTrackedMuscles,
} from "@/lib/queries/progress";
import { Pane } from "@/components/dashboard/pane";
import {
  type ProgressLens,
  type ProgressOption,
} from "@/components/progress/progress-view";
import { ProgressPaneClient } from "@/components/dashboard/panes/progress-pane-client";

export async function ProgressPane({
  userId,
  unit,
  heightCm,
  birthday,
}: {
  userId: string;
  unit: WeightUnit;
  heightCm: number | null;
  birthday: Date | null;
}) {
  // Layouts don't receive searchParams; the client re-seeds from the URL on
  // mount. The server just fetches a sensible default so first paint isn't empty.
  const [exercises, muscles, bodyData] = await Promise.all([
    getTrackedExercises(userId),
    getTrackedMuscles(userId),
    getBodyData(userId, unit),
  ]);

  const exerciseOptions: ProgressOption[] = exercises.map((e) => ({
    value: e.id,
    label: e.name,
  }));
  const muscleOptions: ProgressOption[] = muscles.map((m) => ({
    value: m.key,
    label: m.label,
  }));

  const view: ProgressLens = exerciseOptions.length > 0 ? "exercise" : "muscle";
  const initialKey =
    (view === "muscle" ? muscleOptions : exerciseOptions)[0]?.value ?? null;
  const initialSeries = initialKey
    ? view === "muscle"
      ? await getMuscleProgress(userId, initialKey, unit)
      : await getExerciseProgress(userId, initialKey, unit)
    : null;

  return (
    <Pane>
      <ProgressPaneClient
        unit={unit}
        heightCm={heightCm}
        birthday={birthday ? birthday.toISOString() : null}
        bodyData={bodyData}
        exerciseOptions={exerciseOptions}
        muscleOptions={muscleOptions}
        initialView={view}
        initialKey={initialKey}
        initialSeries={initialSeries}
      />
    </Pane>
  );
}
