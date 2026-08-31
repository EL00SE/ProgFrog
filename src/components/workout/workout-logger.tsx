"use client";

import * as React from "react";
import { Check, Play, Plus, Repeat2, Square, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  EQUIPMENT_LABELS,
  epley1RM,
  formatWeight,
  roleLabel,
  roleShort,
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
import { Checkbox } from "@/components/ui/checkbox";
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

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F"];

function loggedSetCount(we: WE) {
  const timed = we.exercise?.isTimed ?? false;
  return we.sets.filter((s) => !s.isWarmup && (timed ? (s.seconds ?? 0) > 0 : s.reps > 0))
    .length;
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

  function handleAddSet(weId: string) {
    startTransition(async () => {
      const created = await addSet(weId);
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
        reps: patch.reps,
        seconds: patch.seconds,
        weight: patch.weight,
        isDropSet: patch.isDropSet,
        isWarmup: patch.isWarmup,
      });
    });
  }

  function saveExercise(
    weId: string,
    patch: { equipment?: string | null; supersetGroup?: number | null },
  ) {
    startTransition(async () => {
      await updateWorkoutExercise({
        workoutExerciseId: weId,
        equipment: patch.equipment as never,
        supersetGroup: patch.supersetGroup,
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

  const working = exercises.flatMap((e) => e.sets.filter((s) => !s.isWarmup));
  const totalSets = working.length;
  const totalVolume = working.reduce((x, s) => x + s.reps * s.weight, 0);
  const doneCount = exercises.filter(isExerciseDone).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl border p-3 text-center">
        <SummaryStat label="Exercises" value={String(exercises.length)} />
        <SummaryStat label="Working sets" value={String(totalSets)} />
        <SummaryStat
          label={`Volume (${unit.toLowerCase()})`}
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

      {exercises.map((we, i) => (
        <ExerciseCard
          key={we.id}
          we={we}
          index={i}
          total={exercises.length}
          unit={unit}
          disabled={pending}
          catalog={catalog}
          allExercises={exercises}
          onRemove={() => handleRemoveExercise(we.id)}
          onAddSet={() => handleAddSet(we.id)}
          onDeleteSet={(setId) => handleDeleteSet(we.id, setId)}
          onPatchSet={(setId, patch) => patchSet(we.id, setId, patch)}
          onSaveSet={saveSet}
          onAssign={(exerciseId) => handleAssign(we.id, exerciseId)}
          onSetGroup={(group) => {
            patchExercise(we.id, { supersetGroup: group });
            saveExercise(we.id, { supersetGroup: group });
          }}
          onSetEquipment={(eq) => {
            patchExercise(we.id, { equipment: eq as WE["equipment"] });
            saveExercise(we.id, { equipment: eq });
          }}
        />
      ))}

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

function ExerciseCard({
  we,
  index,
  total,
  unit,
  disabled,
  catalog,
  allExercises,
  onRemove,
  onAddSet,
  onDeleteSet,
  onPatchSet,
  onSaveSet,
  onAssign,
  onSetGroup,
  onSetEquipment,
}: {
  we: WE;
  index: number;
  total: number;
  unit: "KG" | "LB";
  disabled: boolean;
  catalog: PickerExercise[];
  allExercises: WE[];
  onRemove: () => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onPatchSet: (setId: string, patch: Partial<SetEntry>) => void;
  onSaveSet: (setId: string, patch: Partial<SetEntry>) => void;
  onAssign: (exerciseId: string) => void | Promise<void>;
  onSetGroup: (group: number | null) => void;
  onSetEquipment: (equipment: string) => void;
}) {
  const groupPartners = we.supersetGroup
    ? allExercises.filter((e) => e.id !== we.id && e.supersetGroup === we.supersetGroup)
        .length
    : 0;

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
    <Card
      className={cn(we.supersetGroup && "border-l-4", done && "opacity-80")}
      style={
        we.supersetGroup
          ? {
              borderLeftColor: `var(--chart-${((we.supersetGroup - 1) % 5) + 1})`,
            }
          : undefined
      }
    >
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
              {we.supersetGroup ? (
                <Badge variant="outline">
                  Superset {GROUP_LETTERS[we.supersetGroup - 1] ?? we.supersetGroup}
                  {groupPartners > 0 ? "" : " · add a partner"}
                </Badge>
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
              value={we.supersetGroup ? String(we.supersetGroup) : "none"}
              onValueChange={(v) => onSetGroup(v === "none" ? null : Number(v))}
            >
              <SelectTrigger size="sm" className="min-w-32 flex-1 sm:flex-none">
                <SelectValue placeholder="Superset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No superset</SelectItem>
                {GROUP_LETTERS.map((letter, i) => (
                  <SelectItem key={letter} value={String(i + 1)}>
                    Superset {letter}
                  </SelectItem>
                ))}
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
          <div className="text-muted-foreground grid grid-cols-[2rem_1fr_1fr_auto_2rem] items-center gap-2 px-1 text-xs font-medium">
            <span>Set</span>
            <span>Weight ({unit.toLowerCase()})</span>
            <span>{timed ? "Seconds" : "Reps"}</span>
            <span className="text-center">Drop</span>
            <span />
          </div>
          {we.sets.map((s, i) => (
            <SetRow
              key={s.id}
              index={i}
              set={s}
              timed={timed}
              disabled={disabled}
              onPatch={(patch) => onPatchSet(s.id, patch)}
              onSave={(patch) => onSaveSet(s.id, patch)}
              onDelete={() => onDeleteSet(s.id)}
            />
          ))}
          <div className="mt-1 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onAddSet} disabled={disabled}>
              <Plus className="size-3.5" /> Add set
            </Button>
            {!timed && best > 0 && (
              <span className="text-muted-foreground text-xs">
                Best e1RM {formatWeight(best, unit)}
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SetRow({
  index,
  set,
  timed,
  disabled,
  onPatch,
  onSave,
  onDelete,
}: {
  index: number;
  set: SetEntry;
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

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_auto_2rem] items-center gap-2">
      <span
        className={
          "text-muted-foreground text-sm tabular-nums" + (set.isWarmup ? " italic" : "")
        }
      >
        {set.isWarmup ? "W" : index + 1}
      </span>
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
          disabled={disabled}
          onChange={(e) => change({ reps: Number(e.target.value) || 0 })}
          onBlur={flush}
        />
      )}
      <div className="flex justify-center">
        <Checkbox
          checked={set.isDropSet}
          disabled={disabled}
          onCheckedChange={(v) => {
            const isDropSet = v === true;
            onPatch({ isDropSet });
            onSave({ isDropSet });
          }}
          aria-label="Drop set"
        />
      </div>
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
