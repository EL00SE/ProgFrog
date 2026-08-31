import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/dal";
import {
  getExerciseProgress,
  getRoleProgress,
  getTrackedExercises,
  getTrackedRoles,
  parseRoleKey,
} from "@/lib/queries/progress";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage({
  searchParams,
}: PageProps<"/dashboard/progress">) {
  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const view = sp.view === "role" ? "role" : "exercise";

  const [exercises, roles] = await Promise.all([
    getTrackedExercises(user.id),
    getTrackedRoles(user.id),
  ]);

  const options =
    view === "role"
      ? roles.map((r) => ({ value: r.key, label: r.label }))
      : exercises.map((e) => ({ value: e.id, label: e.name }));

  const selectedKey =
    (typeof sp[view] === "string" && (sp[view] as string)) || options[0]?.value || null;

  let series = null;
  if (selectedKey) {
    if (view === "role") {
      const parsed = parseRoleKey(selectedKey);
      series = parsed
        ? await getRoleProgress(user.id, parsed.muscle, parsed.role, user.weightUnit)
        : null;
    } else {
      series = await getExerciseProgress(user.id, selectedKey, user.weightUnit);
    }
  }

  const nothingTracked = exercises.length === 0 && roles.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Progress"
        description={`How your strength is trending — estimated 1-rep max (the most you could lift once), heaviest set, and total weight lifted per workout, in ${user.weightUnit.toLowerCase()}.`}
      />

      {nothingTracked ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Log a few workouts and your trends will appear here.
          </CardContent>
        </Card>
      ) : (
        <ProgressView
          view={view}
          hasRoles={roles.length > 0}
          hasExercises={exercises.length > 0}
          options={options}
          selectedKey={selectedKey}
          series={series}
        />
      )}
    </div>
  );
}
