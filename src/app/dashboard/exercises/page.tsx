import type { Metadata } from "next";

import { getCurrentUserId } from "@/lib/dal";
import { getExerciseCatalog, getCustomExercises } from "@/lib/queries/exercises";
import { PageHeader } from "@/components/page-header";
import { ExerciseManager } from "@/components/exercises/exercise-manager";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  const userId = await getCurrentUserId();
  const [catalog, custom] = await Promise.all([
    getExerciseCatalog(userId),
    getCustomExercises(userId),
  ]);

  const globals = catalog.filter((e) => e.ownerId === null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exercises"
        description="The shared catalog plus your own custom exercises. Custom ones are private to your account."
      />

      <ExerciseManager
        globals={globals.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          muscle: e.muscle,
        }))}
        custom={custom.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          muscle: e.muscle,
          isArchived: e.isArchived,
        }))}
      />
    </div>
  );
}
