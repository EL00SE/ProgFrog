import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/lib/dal";
import { formatDate } from "@/lib/training";
import { getExerciseCatalog } from "@/lib/queries/exercises";
import { getExercisePrev } from "@/lib/queries/history";
import { getWorkout } from "@/lib/queries/workouts";
import { BackLink } from "@/components/back-link";
import { WorkoutLogger } from "@/components/workout/workout-logger";
import { FinishedWorkoutView } from "@/components/workout/finished-workout-view";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutPage({
  params,
}: PageProps<"/dashboard/workouts/[id]">) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const workout = await getWorkout(userId, id);
  if (!workout) notFound();

  const title = workout.name ?? "Workout";
  const dateLabel = formatDate(workout.date, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (workout.finishedAt) {
    return <FinishedWorkoutView workout={workout} title={title} dateLabel={dateLabel} />;
  }

  const [catalog, prev] = await Promise.all([
    getExerciseCatalog(userId),
    getExercisePrev(userId, workout.unit),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <BackLink href="/dashboard/workouts">Workouts</BackLink>
        <p className="text-muted-foreground text-sm">{dateLabel}</p>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      <WorkoutLogger
        workout={workout}
        prev={prev}
        catalog={catalog.map((e) => ({
          id: e.id,
          name: e.name,
          equipment: e.equipment,
          muscle: e.muscle,
          isTimed: e.isTimed,
        }))}
      />
    </div>
  );
}
