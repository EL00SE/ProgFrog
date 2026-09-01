import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import { getCurrentUserId } from "@/lib/dal";
import { formatDate, formatWeight } from "@/lib/training";
import { getWorkoutHistory } from "@/lib/queries/workouts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Workouts" };

export default async function WorkoutsPage() {
  const userId = await getCurrentUserId();
  const workouts = await getWorkoutHistory(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workout history"
        description={
          workouts.length > 0
            ? `${workouts.length} finished ${workouts.length === 1 ? "workout" : "workouts"}.`
            : undefined
        }
      >
        <Button asChild size="sm">
          <Link href="/dashboard/workouts/new">
            <Plus className="size-4" /> New workout
          </Link>
        </Button>
      </PageHeader>

      {workouts.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No finished workouts yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workouts.map((w) => (
            <Link
              key={w.id}
              href={`/dashboard/workouts/${w.id}`}
              className="group focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
            >
              <Card
                size="sm"
                className="group-hover:ring-primary/30 h-full transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{w.name ?? "Workout"}</span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {formatDate(w.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {w.exerciseCount} ex · {w.setCount} sets ·{" "}
                    {formatWeight(w.volume, w.unit)}
                  </CardDescription>
                  {w.exerciseNames.length > 0 ? (
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                      {w.exerciseNames.join(" · ")}
                    </p>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
