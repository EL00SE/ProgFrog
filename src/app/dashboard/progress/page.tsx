import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/dal";
import { cn } from "@/lib/utils";
import { getBodyData } from "@/lib/queries/body";
import {
  getExerciseProgress,
  getRoleProgress,
  getTrackedExercises,
  getTrackedRoles,
  parseRoleKey,
} from "@/lib/queries/progress";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { BodyView } from "@/components/progress/body-view";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage({
  searchParams,
}: PageProps<"/dashboard/progress">) {
  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const section = sp.section === "body" ? "body" : "lifts";
  const view = sp.view === "role" ? "role" : "exercise";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Progress"
        description={
          section === "body"
            ? "Track your body weight over time, next to your lifts."
            : `How your strength is trending — estimated 1-rep max (the most you could lift once), heaviest set, and total weight lifted per workout, in ${user.weightUnit.toLowerCase()}.`
        }
      />

      <div className="bg-muted/60 inline-flex w-fit gap-1 rounded-lg p-1 text-sm font-medium">
        {(
          [
            ["lifts", "Lifts"],
            ["body", "Body"],
          ] as const
        ).map(([v, label]) => (
          <Link
            key={v}
            href={
              v === "lifts" ? "/dashboard/progress" : "/dashboard/progress?section=body"
            }
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              section === v
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {section === "body" ? (
        <BodyView
          unit={user.weightUnit}
          heightCm={user.heightCm}
          birthday={user.birthday ? user.birthday.toISOString() : null}
          data={await getBodyData(user.id, user.weightUnit)}
        />
      ) : (
        <LiftsSection userId={user.id} unit={user.weightUnit} view={view} sp={sp} />
      )}
    </div>
  );
}

async function LiftsSection({
  userId,
  unit,
  view,
  sp,
}: {
  userId: string;
  unit: "KG" | "LB";
  view: "role" | "exercise";
  sp: Record<string, string | string[] | undefined>;
}) {
  const [exercises, roles] = await Promise.all([
    getTrackedExercises(userId),
    getTrackedRoles(userId),
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
        ? await getRoleProgress(userId, parsed.muscle, parsed.role, unit)
        : null;
    } else {
      series = await getExerciseProgress(userId, selectedKey, unit);
    }
  }

  if (exercises.length === 0 && roles.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          Log a few workouts and your trends will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <ProgressView
      view={view}
      hasRoles={roles.length > 0}
      hasExercises={exercises.length > 0}
      options={options}
      selectedKey={selectedKey}
      series={series}
    />
  );
}
