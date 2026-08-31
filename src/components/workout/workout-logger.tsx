"use client";

import * as React from "react";
import {
  Check,
  ChevronsDown,
  Link2,
  Play,
  Plus,
  Repeat2,
  Square,
  Timer,
  Trash2,
} from "lucide-react";
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
  LINK_OPTION_LABELS,
  linkedGroupLabel,
  roleLabel,
  roleShort,
  SET_TYPE_CODE,
  SET_TYPE_LABELS,
  SET_TYPE_VALUES,
  type SetType,
} from "@/lib/training";
import type { FullWorkout } from "@/lib/queries/workouts";
import {
  addExerciseToWorkout,
  addSet,
  addSlotToWorkout,
  assignWorkoutEntryExercise,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  removeWorkoutExercise,
  updateSet,
  updateWorkoutExercise,
} from "@/lib/actions/workouts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddSlotDialog } from "@/components/workout/add-slot-dialog";
import {
  ExercisePickerDialog,
  type PickerExercise,
} from "@/components/workout/exercise-picker-dialog";
import { getDefaultRest, restEvent } from "@/components/workout/rest-timer";

type WE = FullWorkout["exercises"][number];
type SetEntry = WE["sets"][number];

function loggedSetCount(we: WE) {
  const timed = we.exercise?.isTimed ?? false;
  return we.sets.filter(
    (s) => isWorkingSet(s) && (timed ? (s.seconds ?? 0) > 0 : s.reps > 0),
  ).length;
}

function isExerciseDone(we: WE) {
  if (!we.exercise) return false;
  const done = loggedSetCount(we);
  return we.targetSets ? done >= we.targetSets : done > 0;
}

export function WorkoutLogger({
  workout,
  catalog,
}: {
  workout: FullWorkout;
  catalog: PickerExercise[];
}) {
  const [exercises, setExercises] = React.useState<WE[]>(workout.exercises);
  const [pending, startTransition] = React.useTransition();
  const unit = workout.unit;

  function patchExercise(id: string, patch: Partial<WE>) {
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function patchSet(weId: string, setId: string, patch: Partial<SetEntry>) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === weId
          ? {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
            }
          : e,
      ),
    );
  }

  async function handlePick(exerciseId: string) {
    const created = await addExerciseToWorkout({
      workoutId: workout.id,
      exerciseId,
    });
    setExercises((prev) => [...prev, created as WE]);
  }

  async function handleAddSlot(slot: { muscle: string; role: string }) {
    const created = await addSlotToWorkout({ workoutId: workout.id, ...slot });
    setExercises((prev) => [...prev, created as WE]);
  }

  async function handleAssign(weId: string, exerciseId: string) {
    const updated = await assignWorkoutEntryExercise({
      workoutExerciseId: weId,
      exerciseId,
    });
    patchExercise(weId, updated as Partial<WE>);
  }

  function handleRemoveExercise(weId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== weId));
    startTransition(async () => {
      await removeWorkoutExercise(weId);
    });
  }

  function handleAddSet(weId: string, opts?: { type?: SetType }) {
    startTransition(async () => {
      const created = await addSet(weId, opts);
      setExercises((prev) =>
        prev.map((e) =>
          e.id === weId ? { ...e, sets: [...e.sets, created as SetEntry] } : e,
        ),
      );
    });
  }

  function handleDeleteSet(weId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === weId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
      ),
    );
    startTransition(async () => {
      await deleteSet(setId);
    });
  }

  function saveSet(setId: string, patch: Partial<SetEntry>) {
    startTransition(async () => {
      await updateSet({
        setId,
        type: patch.type ?? undefined,
        reps: patch.reps,
        seconds: patch.seconds,
        weight: patch.weight,
      });
    });
  }

  function saveExercise(
    weId: string,
    patch: { equipment?: string | null; linkToNext?: ExerciseLink | null },
  ) {
    startTransition(async () => {
      await updateWorkoutExercise({
        workoutExerciseId: weId,
        equipment: patch.equipment as never,
        linkToNext: patch.linkToNext,
      });
    });
  }

  function handleFinish() {
    if (exercises.length === 0) {
      toast.error("Add at least one exercise first");
      return;
    }
    startTransition(() => finishWorkout(workout.id));
  }

  function handleDiscard() {
    if (!confirm("Discard this workout and everything logged in it?")) return;
    startTransition(() => deleteWorkout(workout.id));
  }

  const working = exercises.flatMap((e) => e.sets.filter(isWorkingSet));
  const totalSets = working.length;
  const totalVolume = working.reduce((x, s) => x + s.reps * s.weight, 0);
  const doneCount = exercises.filter(isExerciseDone).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl border p-3 text-center">
        <SummaryStat label="Exercises" value={String(exercises.length)} />
        <SummaryStat label="Sets" value={String(totalSets)} />
        <SummaryStat
          label={`Weight lifted (${unit.toLowerCase()})`}
          value={Math.round(totalVolume).toLocaleString("en-US")}
        />
      </div>

      {exercises.length > 0 && (
        <div className="bg-background/85 sticky top-14 z-20 -mx-4 flex items-center gap-3 border-b px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-lg md:border md:px-3">
          <span className="text-sm font-medium tabular-nums">
            {doneCount} / {exercises.length} done
          </span>
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{
                width: `${exercises.length ? (doneCount / exercises.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {exercises.length === 0 && (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Nothing here yet — add an exercise or an open slot below.
        </p>
      )}

      {groupLinkedExercises(exercises).map((group, gi) => {
        const cardProps = (we: WE) => ({
          we,
          index: exercises.findIndex((e) => e.id === we.id),
          total: exercises.length,
          unit,
          disabled: pending,
          catalog,
          onRemove: () => handleRemoveExercise(we.id),
          onAddSet: () => handleAddSet(we.id),
          onAddDropSet: () => handleAddSet(we.id, { type: "DROP" }),
          onDeleteSet: (setId: string) => handleDeleteSet(we.id, setId),
          onPatchSet: (setId: string, patch: Partial<SetEntry>) =>
            patchSet(we.id, setId, patch),
          onSaveSet: saveSet,
          onAssign: (exerciseId: string) => handleAssign(we.id, exerciseId),
          onSetLink: (link: ExerciseLink | null) => {
            patchExercise(we.id, { linkToNext: link });
            saveExercise(we.id, { linkToNext: link });
          },
          onSetEquipment: (eq: string) => {
            patchExercise(we.id, { equipment: eq as WE["equipment"] });
            saveExercise(we.id, { equipment: eq });
          },
        });

        if (group.length === 1) {
          return <ExerciseCard key={group[0].id} {...cardProps(group[0])} />;
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
                <ExerciseCard {...cardProps(we)} inGroup />
                {k < group.length - 1 && we.linkToNext ? (
                  <LinkJoiner link={we.linkToNext} />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        );
      })}

      <div className="flex flex-col gap-2 sm:flex-row">
        <ExercisePickerDialog
          catalog={catalog}
          onPick={handlePick}
          trigger={
            <Button variant="outline" className="w-full sm:flex-1" disabled={pending}>
              <Plus className="size-4" /> Add exercise
            </Button>
          }
        />
        <AddSlotDialog
          onAdd={handleAddSlot}
          trigger={
            <Button variant="outline" className="w-full sm:flex-1" disabled={pending}>
              <Plus className="size-4" /> Add slot
            </Button>
          }
        />
      </div>

      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          variant="destructive"
          onClick={handleDiscard}
          disabled={pending}
          className="sm:w-auto"
        >
          <Trash2 className="size-4" /> Discard
        </Button>
        <Button onClick={handleFinish} disabled={pending} className="sm:flex-1">
          <Check className="size-4" /> Finish workout
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-heading text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[0.7rem] tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

/** The labelled "no rest — go straight on" divider shown between linked cards. */
function LinkJoiner({ link }: { link: ExerciseLink }) {
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

function ExerciseCard({
  we,
  index,
  total,
  unit,
  disabled,
  catalog,
  inGroup = false,
  onRemove,
  onAddSet,
  onAddDropSet,
  onDeleteSet,
  onPatchSet,
  onSaveSet,
  onAssign,
  onSetLink,
  onSetEquipment,
}: {
  we: WE;
  index: number;
  total: number;
  unit: "KG" | "LB";
  disabled: boolean;
  catalog: PickerExercise[];
  inGroup?: boolean;
  onRemove: () => void;
  onAddSet: () => void;
  onAddDropSet: () => void;
  onDeleteSet: (setId: string) => void;
  onPatchSet: (setId: string, patch: Partial<SetEntry>) => void;
  onSaveSet: (setId: string, patch: Partial<SetEntry>) => void;
  onAssign: (exerciseId: string) => void | Promise<void>;
  onSetLink: (link: ExerciseLink | null) => void;
  onSetEquipment: (equipment: string) => void;
}) {
  const timed = we.exercise?.isTimed ?? false;
  const best = we.sets.reduce((m, s) => Math.max(m, epley1RM(s.weight, s.reps)), 0);
  const unfilled = !we.exercise;
  const done = isExerciseDone(we);
  const target =
    we.targetSets || we.targetReps
      ? timed
        ? `Target: ${we.targetReps ?? "—"}${/\D/.test(we.targetReps ?? "") ? "" : "s"}${
            we.targetSets ? ` × ${we.targetSets}` : ""
          }`
        : `Target: ${we.targetSets ?? "—"} × ${we.targetReps ?? "—"}`
      : null;

  return (
    <Card className={cn(inGroup && "shadow-none", done && "opacity-80")}>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums",
                  done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="font-heading font-medium">
                {we.exercise?.name ?? roleLabel(we.muscle, we.role)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {we.muscle ? <Badge variant="secondary">{we.muscle}</Badge> : null}
              {we.role ? <Badge variant="ghost">{roleShort(we.role)}</Badge> : null}
              {timed ? <Badge variant="ghost">Timed</Badge> : null}
              {we.linkToNext ? (
                <Badge variant="outline">{LINK_LABELS[we.linkToNext]} → next</Badge>
              ) : null}
            </div>
            {target ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {target} · exercise {index + 1} of {total}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                Exercise {index + 1} of {total}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {unfilled ? (
          <ExercisePickerDialog
            catalog={catalog}
            lockMuscle={we.muscle}
            lockRole={we.role}
            title="Choose exercise"
            onPick={onAssign}
            trigger={
              <Button variant="outline" size="sm" className="w-fit" disabled={disabled}>
                <Plus className="size-3.5" /> Choose exercise
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Select value={we.equipment ?? "BARBELL"} onValueChange={onSetEquipment}>
              <SelectTrigger size="sm" className="min-w-32 flex-1 sm:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EQUIPMENT_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={we.linkToNext ?? "none"}
              onValueChange={(v) => onSetLink(v === "none" ? null : (v as ExerciseLink))}
            >
              <SelectTrigger
                size="sm"
                className="min-w-40 flex-1"
                aria-label="What to do after this exercise"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{LINK_OPTION_LABELS.NONE}</SelectItem>
                <SelectItem value="SUPERSET">{LINK_OPTION_LABELS.SUPERSET}</SelectItem>
                <SelectItem value="DROP_SET">{LINK_OPTION_LABELS.DROP_SET}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => window.dispatchEvent(restEvent(getDefaultRest()))}
            >
              <Timer className="size-3.5" /> Rest
            </Button>

            {(we.muscle || we.role) && (
              <ExercisePickerDialog
                catalog={catalog}
                lockMuscle={we.muscle}
                lockRole={we.role}
                title="Swap exercise"
                onPick={onAssign}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label="Swap exercise"
                  >
                    <Repeat2 className="size-3.5" /> Swap
                  </Button>
                }
              />
            )}
          </div>
        )}
      </CardHeader>

      {!unfilled && (
        <CardContent className="flex flex-col gap-1.5">
          <div className="text-muted-foreground grid grid-cols-[3.25rem_1fr_1fr_1.75rem] items-center gap-2 px-1 text-xs font-medium">
            <span>Type</span>
            <span>Weight ({unit.toLowerCase()})</span>
            <span>{timed ? "Seconds" : "Reps"}</span>
            <span />
          </div>
          {(() => {
            let n = 0;
            return we.sets.map((s) => {
              const number = s.type === "WARMUP" ? null : (n += 1);
              return (
                <SetRow
                  key={s.id}
                  set={s}
                  number={number}
                  defaultReps={we.targetReps}
                  timed={timed}
                  disabled={disabled}
                  onPatch={(patch) => onPatchSet(s.id, patch)}
                  onSave={(patch) => onSaveSet(s.id, patch)}
                  onDelete={() => onDeleteSet(s.id)}
                />
              );
            });
          })()}
          <p className="text-muted-foreground px-1 text-[0.7rem]">
            Tap a set&rsquo;s type — <b>W</b> warm-up · <b>D</b> drop set · <b>F</b> to
            failure. Warm-ups don&rsquo;t count toward your totals.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={onAddSet} disabled={disabled}>
                <Plus className="size-3.5" /> Add set
              </Button>
              {!timed ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddDropSet}
                  disabled={disabled}
                  title="Adds a set marked as a drop — lower the weight and rep out again with no rest"
                >
                  <ChevronsDown className="size-3.5" /> Add drop set
                </Button>
              ) : null}
            </div>
            {!timed && best > 0 && (
              <span className="text-muted-foreground text-xs">
                Est. 1-rep max {formatWeight(best, unit)}
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const SET_TYPE_TONE: Record<SetType, string> = {
  WARMUP: "text-amber-600 dark:text-amber-400",
  NORMAL: "text-muted-foreground",
  DROP: "text-violet-600 dark:text-violet-400",
  FAILURE: "text-rose-600 dark:text-rose-400",
};

function SetRow({
  set,
  number,
  defaultReps,
  timed,
  disabled,
  onPatch,
  onSave,
  onDelete,
}: {
  set: SetEntry;
  number: number | null;
  defaultReps: string | null;
  timed: boolean;
  disabled: boolean;
  onPatch: (patch: Partial<SetEntry>) => void;
  onSave: (patch: Partial<SetEntry>) => void;
  onDelete: () => void;
}) {
  const pending = React.useRef<Partial<SetEntry>>({});
  const timer = React.useRef<number | undefined>(undefined);

  const flush = React.useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (Object.keys(pending.current).length) {
      onSave({ ...pending.current });
      pending.current = {};
    }
  }, [onSave]);

  // Save anything pending if the row unmounts (e.g. you navigate away mid-type).
  const flushRef = React.useRef(flush);
  React.useEffect(() => {
    flushRef.current = flush;
  });
  React.useEffect(() => () => flushRef.current(), []);

  function change(patch: Partial<SetEntry>) {
    onPatch(patch);
    pending.current = { ...pending.current, ...patch };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 450);
  }

  const token = set.type === "NORMAL" ? (number ?? "•") : SET_TYPE_CODE[set.type];

  return (
    <div className="grid grid-cols-[3.25rem_1fr_1fr_1.75rem] items-center gap-2">
      <Select
        value={set.type}
        onValueChange={(v) => {
          onPatch({ type: v as SetType });
          onSave({ type: v as SetType });
        }}
      >
        <SelectTrigger
          size="sm"
          disabled={disabled}
          aria-label={`Set type — ${SET_TYPE_LABELS[set.type]}`}
          className={cn(
            "h-9 w-full justify-center px-1.5 font-semibold tabular-nums",
            SET_TYPE_TONE[set.type],
          )}
        >
          {token}
        </SelectTrigger>
        <SelectContent>
          {SET_TYPE_VALUES.map((t) => (
            <SelectItem key={t} value={t}>
              {SET_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        defaultValue={set.weight || ""}
        disabled={disabled}
        onChange={(e) => change({ weight: Number(e.target.value) || 0 })}
        onBlur={flush}
      />
      {timed ? (
        <TimedInput
          seconds={set.seconds ?? 0}
          disabled={disabled}
          onChange={(seconds) => change({ seconds })}
          onFlush={flush}
        />
      ) : (
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          defaultValue={set.reps || ""}
          placeholder={set.targetReps ?? defaultReps ?? ""}
          disabled={disabled}
          onChange={(e) => change({ reps: Number(e.target.value) || 0 })}
          onBlur={flush}
        />
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete set"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/** Seconds field with a built-in count-up stopwatch. */
function TimedInput({
  seconds,
  disabled,
  onChange,
  onFlush,
}: {
  seconds: number;
  disabled: boolean;
  onChange: (seconds: number) => void;
  onFlush: () => void;
}) {
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(seconds);
  const startedAt = React.useRef(0);

  React.useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now() - elapsed * 1000;
    const id = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function toggle() {
    if (running) {
      setRunning(false);
      onChange(elapsed);
      onFlush();
    } else {
      setRunning(true);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        inputMode="numeric"
        min="0"
        value={running ? elapsed : seconds || ""}
        disabled={disabled || running}
        onChange={(e) => {
          const v = Number(e.target.value) || 0;
          setElapsed(v);
          onChange(v);
        }}
        onBlur={onFlush}
      />
      <Button
        type="button"
        variant={running ? "default" : "outline"}
        size="icon-sm"
        onClick={toggle}
        disabled={disabled}
        aria-label={running ? "Stop" : "Start hold"}
      >
        {running ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
    </div>
  );
}
