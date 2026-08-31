import type { Metadata } from "next";

import { getCurrentUserId } from "@/lib/dal";
import { getTemplates } from "@/lib/queries/templates";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { StartWorkoutPicker } from "@/components/workout/start-workout-picker";

export const metadata: Metadata = { title: "Start a workout" };

export default async function NewWorkoutPage() {
  const userId = await getCurrentUserId();
  const templates = await getTemplates(userId);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="space-y-1">
        <BackLink href="/dashboard">Dashboard</BackLink>
        <PageHeader
          title="Start a workout"
          description="Pick a day from a template, or go freestyle."
        />
      </div>
      <StartWorkoutPicker
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          days: t.days.map((d) => ({
            id: d.id,
            name: d.name,
            slots: d._count.exercises,
          })),
        }))}
      />
    </div>
  );
}
