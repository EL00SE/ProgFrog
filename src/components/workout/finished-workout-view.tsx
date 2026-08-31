"use client";

import * as React from "react";
import { Check, ChevronsDown, Clock, Link2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  EQUIPMENT_LABELS,
  epley1RM,
  type ExerciseLink,
  formatWeight,
  groupLinkedExercises,
  isWorkingSet,
  LINK_HINTS,
  LINK_LABELS,
  linkedGroupLabel,
  roleLabel,
  roleShort,
  SET_TYPE_SHORT,
  topSet,
} from "@/lib/training";
import type { FullWorkout } from "@/lib/queries/workouts";
import { deleteWorkout, reopenWorkout, updateWorkout } from "@/lib/actions/workouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";

/** Minutes → "1h 24m" / "48m". */
function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** A Date → the `YYYY-MM-DDTHH:mm` a <input type="datetime-local"> expects. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function SessionTimes({ workout }: { workout: FullWorkout }) {
  const [editing, setEditing] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const started = new Date(workout.startedAt);
  const ended = workout.endedAt ? new Date(workout.endedAt) : null;
  const [startVal, setStartVal] = React.useState(toLocalInput(started));
  const [endVal, setEndVal] = React.useState(ended ? toLocalInput(ended) : "");

  const timeFmt: Intl.DateTimeFormatOptions = {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  };

  function save() {
    const startDate = new Date(startVal);
    const endDate = endVal ? new Date(endVal) : null;
    if (Number.isNaN(startDate.getTime())) return;
    if (endDate && endDate < startDate) {
      toast.error("The session can't end before it starts");
      return;
    }
    startTransition(async () => {
      try {
        await updateWorkout({
          workoutId: workout.id,
          startedAt: startDate.toISOString(),
          endedAt: endDate ? endDate.toISOString() : null,
        });
        setEditing(false);
      } catch {
        toast.error("Couldn't save the times");
      }
    });
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3 text-sm">
      {editing ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Started</span>
            <Input
              type="datetime-local"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Ended</span>
            <Input
              type="datetime-local"
              value={endVal}
              onChange={(e) => setEndVal(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              <Check className="size-4" /> Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setStartVal(toLocalInput(started));
                setEndVal(ended ? toLocalInput(ended) : "");
                setEditing(false);
              }}
            >
              <X className="size-4" /> Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-4 shrink-0" />
            <span>
              {started.toLocaleString("en-US", timeFmt)}
              {ended ? (
                <>
                  {" → "}
                  {ended.toLocaleString("en-US", timeFmt)}
                  <span className="text-muted-foreground">
                    {"  ·  "}
                    {formatDuration((ended.getTime() - started.getTime()) / 60000)}
                  </span>
                </>
              ) : null}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit session times"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

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

  const working = workout.exercises.flatMap((e) => e.sets.filter(isWorkingSet));
  const volume = working.reduce((n, s) => n + s.reps * s.weight, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <BackLink href="/dashboard/workouts">Workouts</BackLink>
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {workout.exercises.length} exercises · {working.length} sets ·{" "}
            {formatWeight(volume, unit)} lifted
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

      <SessionTimes workout={workout} />

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
    we.sets.map((s) => ({ reps: s.reps, weight: s.weight, type: s.type })),
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
            <span className="text-muted-foreground">
              {s.type === "WARMUP" ? "W" : i + 1}
            </span>
            <span>{formatWeight(s.weight, unit)}</span>
            <span>{timed ? `${s.seconds ?? 0}s` : `${s.reps} reps`}</span>
            <span>
              {s.type === "DROP" || s.type === "FAILURE" ? (
                <Badge variant="ghost" className="text-xs lowercase">
                  {SET_TYPE_SHORT[s.type]}
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
                  Heaviest set {formatWeight(top.weight, unit)} × {top.reps}
                </span>
              ) : null}
              {best > 0 ? <span>est. 1-rep max {formatWeight(best, unit)}</span> : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
