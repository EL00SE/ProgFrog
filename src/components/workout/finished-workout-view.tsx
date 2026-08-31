"use client";

import * as React from "react";
import { ChevronsDown, Link2, Pencil, Trash2 } from "lucide-react";

import {
  EQUIPMENT_LABELS,
  epley1RM,
  type ExerciseLink,
  formatWeight,
  groupLinkedExercises,
  LINK_HINTS,
  LINK_LABELS,
  linkedGroupLabel,
  roleLabel,
  roleShort,
  topSet,
} from "@/lib/training";
import type { FullWorkout } from "@/lib/queries/workouts";
import { deleteWorkout, reopenWorkout } from "@/lib/actions/workouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";

type WE = FullWorkout["exercises"][number];

export function FinishedWorkoutView({
  workout,
  title,
  dateLabel,
}: {
  workout: FullWorkout;
  title: string;
  dateLabel: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const unit = workout.unit;

  const working = workout.exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  const volume = working.reduce((n, s) => n + s.reps * s.weight, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <BackLink href="/dashboard/workouts">Workouts</BackLink>
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {workout.exercises.length} exercises · {working.length} working sets ·{" "}
            {formatWeight(volume, unit)} volume
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => reopenWorkout(workout.id))}
          >
            <Pencil className="size-4" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this workout permanently?")) {
                startTransition(() => deleteWorkout(workout.id));
              }
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      {workout.notes ? (
        <p className="text-muted-foreground bg-muted/40 rounded-lg p-3 text-sm">
          {workout.notes}
        </p>
      ) : null}

      {groupLinkedExercises(workout.exercises).map((group, gi) => {
        if (group.length === 1) {
          return <ExerciseBlock key={group[0].id} we={group[0]} unit={unit} />;
        }
        const accent = `var(--chart-${(gi % 5) + 1})`;
        return (
          <div
            key={group[0].id}
            className="bg-muted/20 flex flex-col gap-2 rounded-xl border border-l-4 p-2 sm:p-3"
            style={{ borderLeftColor: accent }}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1">
              <Link2 className="size-4 shrink-0" style={{ color: accent }} />
              <span className="text-sm font-semibold">{linkedGroupLabel(group)}</span>
              <span className="text-muted-foreground text-xs">
                {group.length} exercises, no rest between them
              </span>
            </div>
            {group.map((we, k) => (
              <React.Fragment key={we.id}>
                <ExerciseBlock we={we} unit={unit} inGroup />
                {k < group.length - 1 && we.linkToNext ? (
                  <LinkNote link={we.linkToNext} />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LinkNote({ link }: { link: ExerciseLink }) {
  return (
    <div className="text-muted-foreground flex items-start gap-1.5 px-2 text-xs">
      <ChevronsDown className="mt-px size-3.5 shrink-0" />
      <span>
        <span className="text-foreground font-medium">{LINK_LABELS[link]}</span> —{" "}
        {LINK_HINTS[link]}
      </span>
    </div>
  );
}

function ExerciseBlock({
  we,
  unit,
  inGroup = false,
}: {
  we: WE;
  unit: "KG" | "LB";
  inGroup?: boolean;
}) {
  const timed = we.exercise?.isTimed ?? false;
  const best = timed
    ? 0
    : we.sets.reduce((m, s) => Math.max(m, epley1RM(s.weight, s.reps)), 0);
  const top = topSet(
    we.sets.map((s) => ({ reps: s.reps, weight: s.weight, isWarmup: s.isWarmup })),
  );
  const longestHold = timed
    ? we.sets.reduce((m, s) => Math.max(m, s.seconds ?? 0), 0)
    : 0;

  return (
    <Card className={cn(inGroup && "shadow-none")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {we.exercise?.name ?? roleLabel(we.muscle, we.role)}
          {we.exercise && we.role ? (
            <Badge variant="ghost">{roleShort(we.role)}</Badge>
          ) : null}
          <Badge variant="secondary">
            {EQUIPMENT_LABELS[we.equipment ?? we.exercise?.equipment ?? "OTHER"]}
          </Badge>
          {we.linkToNext ? (
            <Badge variant="outline">{LINK_LABELS[we.linkToNext]} → next</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        {we.sets.map((s, i) => (
          <div
            key={s.id}
            className="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2 tabular-nums"
          >
            <span className="text-muted-foreground">{s.isWarmup ? "W" : i + 1}</span>
            <span>{formatWeight(s.weight, unit)}</span>
            <span>{timed ? `${s.seconds ?? 0}s` : `${s.reps} reps`}</span>
            <span>
              {s.isDropSet ? (
                <Badge variant="ghost" className="text-xs">
                  drop
                </Badge>
              ) : null}
            </span>
          </div>
        ))}
        <div className="text-muted-foreground mt-1 flex gap-4 text-xs">
          {timed ? (
            longestHold > 0 ? (
              <span>Longest hold {longestHold}s</span>
            ) : null
          ) : (
            <>
              {top ? (
                <span>
                  Top set {formatWeight(top.weight, unit)} × {top.reps}
                </span>
              ) : null}
              {best > 0 ? <span>e1RM {formatWeight(best, unit)}</span> : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
