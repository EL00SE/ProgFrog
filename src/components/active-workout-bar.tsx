import Link from "next/link";
import { Dot } from "lucide-react";

import { getSession } from "@/lib/dal";
import { getActiveWorkout } from "@/lib/queries/workouts";
import { ActiveWorkoutBarShell } from "@/components/active-workout-bar-client";

/** Slim "workout in progress" bar shown across the dashboard while one is open. */
export async function ActiveWorkoutBar() {
  const session = await getSession();
  if (!session?.user) return null;

  const active = await getActiveWorkout(session.user.id);
  if (!active) return null;

  const href = `/dashboard/workouts/${active.id}`;

  return (
    <ActiveWorkoutBarShell href={href}>
      <Link
        href={href}
        className="bg-primary/10 text-primary hover:bg-primary/15 flex items-center justify-center gap-1 py-1.5 text-sm font-medium transition-colors"
      >
        <Dot className="size-5 animate-pulse" />
        {active.name ?? "Workout"} in progress — Resume
      </Link>
    </ActiveWorkoutBarShell>
  );
}
