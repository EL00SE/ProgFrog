import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flame, Play } from "lucide-react";

import { getCurrentUser } from "@/lib/dal";
import { formatDate } from "@/lib/training";
import {
  type DashboardStats,
  getActiveWorkout,
  getDashboardStats,
  getRecentWorkouts,
} from "@/lib/queries/workouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FrogMark } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { StartWorkoutButton } from "@/components/workout/start-workout-button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [active, recent, stats] = await Promise.all([
    getActiveWorkout(user.id),
    getRecentWorkouts(user.id, 6),
    getDashboardStats(user.id, user.weightUnit),
  ]);

  const unit = user.weightUnit;
  const firstName = user.name?.split(" ")[0] ?? "there";
  const hasHistory = stats.lifetime.workouts > 0;

  return (
    <div className="flex flex-col gap-6 md:gap-5">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          active
            ? "You have a workout in progress."
            : hasHistory
              ? "Log today's session to keep the numbers moving."
              : "Ready to train? Start today's workout."
        }
      >
        {active ? (
          <Button asChild size="lg">
            <Link href={`/dashboard/workouts/${active.id}`}>
              <Play className="size-4" /> Resume workout
            </Link>
          </Button>
        ) : (
          <StartWorkoutButton />
        )}
      </PageHeader>

      {hasHistory ? (
        <div className="flex flex-col gap-4 md:gap-3">
          <StreakCard stats={stats} />
          <Scoreboard stats={stats} unit={unit} />
        </div>
      ) : (
        <Card className="from-primary/10 bg-gradient-to-b to-transparent">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FrogMark className="size-12" />
            <p className="max-w-sm text-base font-medium">
              Every rep counts once you log it.
            </p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Log your first workout and this dashboard turns into a scoreboard — streaks,
              total weight lifted, weekly progress.
            </p>
            <StartWorkoutButton label="Log your first workout" />
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent workouts</h2>
          {recent.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/workouts">View all</Link>
            </Button>
          )}
        </div>

        {recent.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Finished workouts show up here.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((w) => (
              <Link
                key={w.id}
                href={`/dashboard/workouts/${w.id}`}
                className="group focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
              >
                <Card
                  size="sm"
                  className="group-hover:ring-primary/40 h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-black/5"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="truncate">{w.name ?? "Workout"}</span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                    <CardDescription>
                      {formatDate(w.date, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {w.exerciseCount} exercises · {w.setCount} sets ·{" "}
                      {formatCompact(w.volume)} {unit.toLowerCase()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5">
                    {w.exerciseNames.slice(0, 4).map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                    {w.exerciseNames.length > 4 && (
                      <Badge variant="ghost">+{w.exerciseNames.length - 4}</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatCompact(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function StreakCard({ stats }: { stats: DashboardStats }) {
  const weeks = stats.streakWeeks;
  const trainedThisWeek = stats.thisWeek.workouts > 0;

  return (
    <Card className="ring-primary/25 from-primary/12 overflow-hidden bg-gradient-to-br via-transparent to-transparent">
      <CardContent className="flex items-center gap-3 py-1.5">
        <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Flame className="size-5" />
        </div>
        <div className="min-w-0">
          {weeks > 0 ? (
            <>
              <p className="font-heading font-semibold">{weeks}-week streak</p>
              <p className="text-muted-foreground text-sm">
                {trainedThisWeek
                  ? "This week is in the books. Keep it rolling."
                  : "Train once this week to keep the streak alive."}
              </p>
            </>
          ) : (
            <>
              <p className="font-heading font-semibold">Start a streak</p>
              <p className="text-muted-foreground text-sm">
                Log a workout this week to get your streak going.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Scoreboard({ stats, unit }: { stats: DashboardStats; unit: "KG" | "LB" }) {
  const { lifetime, thisWeek, lastWeek } = stats;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          All time
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <BigStat label="Workouts" value={formatCompact(lifetime.workouts)} />
          <BigStat
            label={`Weight lifted · ${unit.toLowerCase()}`}
            value={formatCompact(lifetime.volume)}
          />
          <BigStat label="Reps" value={formatCompact(lifetime.reps)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          This week
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <WeekStat label="Workouts" value={thisWeek.workouts} prev={lastWeek.workouts} />
          <WeekStat label="Sets" value={thisWeek.sets} prev={lastWeek.sets} />
          <WeekStat
            label={`Weight lifted · ${unit.toLowerCase()}`}
            value={thisWeek.volume}
            prev={lastWeek.volume}
            format={formatCompact}
          />
        </div>
      </section>
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5 py-1">
        <span className="font-heading text-primary text-xl font-semibold tabular-nums sm:text-2xl">
          {value}
        </span>
        <span className="text-muted-foreground text-[0.7rem] tracking-wide uppercase">
          {label}
        </span>
      </CardContent>
    </Card>
  );
}

function WeekStat({
  label,
  value,
  prev,
  format = (n: number) => String(n),
}: {
  label: string;
  value: number;
  prev: number;
  format?: (n: number) => string;
}) {
  const delta = value - prev;
  const pct = prev > 0 ? Math.round((delta / prev) * 100) : null;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5 py-1">
        <span className="font-heading text-xl font-semibold tabular-nums sm:text-2xl">
          {format(value)}
        </span>
        <span className="text-muted-foreground text-[0.7rem] tracking-wide uppercase">
          {label}
        </span>
        <span
          className={
            "mt-0.5 text-[0.7rem] font-medium " +
            (delta > 0
              ? "text-primary"
              : delta < 0
                ? "text-muted-foreground"
                : "text-muted-foreground")
          }
        >
          {prev === 0 && value === 0
            ? "—"
            : delta === 0
              ? "same as last week"
              : `${delta > 0 ? "+" : "−"}${format(Math.abs(delta))}${
                  pct !== null ? ` (${delta > 0 ? "+" : "−"}${Math.abs(pct)}%)` : ""
                }`}
        </span>
      </CardContent>
    </Card>
  );
}
