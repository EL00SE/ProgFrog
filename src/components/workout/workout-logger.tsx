"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronUp,
  CloudOff,
  Link2,
  Play,
  Plus,
  RefreshCw,
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
  formatDate,
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
import { deleteWorkout, finishWorkout } from "@/lib/actions/workouts";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { outbox, useOutboxStatus } from "@/lib/offline-queue";
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
import { WheelField } from "@/components/workout/wheel-field";
import type { ExercisePrev } from "@/lib/queries/history";

type WE = FullWorkout["exercises"][number];
type SetEntry = WE["sets"][number];
type PrevMap = Record<string, ExercisePrev>;

/** "Aug 21 — 60×8, 60×8, 55×6 kg" from a previous session. */
function formatPrev(prev: ExercisePrev, unit: "KG" | "LB", timed: boolean): string {
  const shown = prev.sets.slice(0, 5);
  const parts = shown.map((s) =>
    timed ? `${s.seconds ?? 0}s` : `${s.weight}×${s.reps}`,
  );
  const more = prev.sets.length - shown.length;
  return `${formatDate(prev.date, { month: "short", day: "numeric" })} — ${parts.join(
    ", ",
  )}${more > 0 ? ` +${more}` : ""}${timed ? "" : ` ${unit.toLowerCase()}`}`;
}

/** One-line recap for a collapsed, finished exercise: "4 sets · 560 kg". */
function collapsedSummary(we: WE, unit: "KG" | "LB"): string {
  const timed = we.exercise?.isTimed ?? false;
  const working = we.sets.filter(isWorkingSet);
  const n = working.length;
  if (timed) {
    const secs = working.reduce((x, s) => x + (s.seconds ?? 0), 0);
    return `${n} ${n === 1 ? "hold" : "holds"} · ${secs}s`;
  }
  const vol = working.reduce((x, s) => x + s.reps * s.weight, 0);
  return `${n} ${n === 1 ? "set" : "sets"} · ${formatWeight(vol, unit)}`;
}

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

// --- offline snapshot + optimistic set seeding ----------------------------

const SNAP_PREFIX = "progfrog:wsnap:";
const SNAP_TTL = 24 * 60 * 60 * 1000;

function loadSnapshot(workoutId: string, fallback: WE[]): WE[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SNAP_PREFIX + workoutId);
    if (!raw) return fallback;
    const snap = JSON.parse(raw) as { at: number; exercises: WE[] };
    // Only trust it while there's unsynced work (or we're offline) and it's fresh.
    const useful = outbox.pending() > 0 || !navigator.onLine;
    if (useful && Date.now() - snap.at < SNAP_TTL) return snap.exercises;
  } catch {
    /* ignore corrupt snapshot */
  }
  return fallback;
}

function saveSnapshot(workoutId: string, exercises: WE[]) {
  try {
    localStorage.setItem(
      SNAP_PREFIX + workoutId,
      JSON.stringify({ at: Date.now(), exercises }),
    );
  } catch {
    /* quota / private mode */
  }
}

function clearSnapshot(workoutId: string) {
  try {
    localStorage.removeItem(SNAP_PREFIX + workoutId);
  } catch {
    /* ignore */
  }
}

let tmpSeq = 0;
const tmpSetId = () => `local_s_${Date.now().toString(36)}_${tmpSeq++}`;
const tmpWeId = () => `local_e_${Date.now().toString(36)}_${tmpSeq++}`;

/** Build an optimistic WorkoutExercise for the logger's local state. */
function optimisticWE(
  id: string,
  order: number,
  opts: {
    exercise?: PickerExercise;
    muscle?: string | null;
    role?: string | null;
  },
): WE {
  const ex = opts.exercise;
  return {
    id,
    workoutId: "",
    exerciseId: ex?.id ?? null,
    exercise: ex
      ? {
          id: ex.id,
          name: ex.name,
          equipment: ex.equipment,
          isTimed: ex.isTimed ?? false,
        }
      : null,
    muscle: opts.muscle ?? ex?.muscle ?? null,
    role: opts.role ?? null,
    targetSets: null,
    targetReps: null,
    order,
    equipment: ex?.equipment ?? null,
    linkToNext: null,
    notes: null,
    sets: [],
  } as unknown as WE;
}

/** What a fresh set should start at — matches the server's addSet() seeding. */
function seedSet(we: WE, type: SetType, prev: PrevMap): { weight: number; reps: number } {
  const last = we.sets.at(-1);
  const fromPrev = we.exercise ? prev[we.exercise.id]?.sets[0] : undefined;
  let weight = last?.weight ?? fromPrev?.weight ?? 0;
  const reps = last?.reps ?? fromPrev?.reps ?? 0;
  if (type === "DROP" && weight > 0) {
    weight = Math.max(0, Math.round(weight * 0.8 * 2) / 2);
  }
  return { weight, reps };
}

export function WorkoutLogger({
  workout,
  catalog,
  prev,
}: {
  workout: FullWorkout;
  catalog: PickerExercise[];
  prev: PrevMap;
}) {
  const router = useRouter();
  const { online, pending: syncPending } = useOutboxStatus();
  const [exercises, setExercises] = React.useState<WE[]>(() =>
    loadSnapshot(workout.id, workout.exercises),
  );
  const [busy, startTransition] = React.useTransition();
  const unit = workout.unit;

  // Persist local state so a reload (from the cached page, offline) keeps edits.
  React.useEffect(() => {
    const t = setTimeout(() => saveSnapshot(workout.id, exercises), 600);
    return () => clearTimeout(t);
  }, [workout.id, exercises]);

  // When a queued create (set / exercise / custom exercise) syncs, swap its
  // temp id for the real one everywhere it appears in local state.
  React.useEffect(
    () =>
      outbox.onSwap((tempId, realId) =>
        setExercises((list) =>
          list.map((e) => ({
            ...e,
            id: e.id === tempId ? realId : e.id,
            exerciseId: e.exerciseId === tempId ? realId : e.exerciseId,
            exercise:
              e.exercise?.id === tempId ? { ...e.exercise, id: realId } : e.exercise,
            sets: e.sets.map((s) => (s.id === tempId ? { ...s, id: realId } : s)),
          })),
        ),
      ),
    [],
  );

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

  function handlePick(exerciseId: string, exercise?: PickerExercise) {
    const tempId = tmpWeId();
    setExercises((list) => [...list, optimisticWE(tempId, list.length, { exercise })]);
    outbox.addExercise(tempId, { workoutId: workout.id, exerciseId });
  }

  function handleAddSlot(slot: { muscle: string; role: string }) {
    const tempId = tmpWeId();
    setExercises((list) => [
      ...list,
      optimisticWE(tempId, list.length, { muscle: slot.muscle, role: slot.role }),
    ]);
    outbox.addSlot(tempId, { workoutId: workout.id, ...slot });
  }

  function handleAssign(weId: string, exerciseId: string, exercise?: PickerExercise) {
    setExercises((list) =>
      list.map((e) =>
        e.id === weId
          ? {
              ...e,
              exerciseId,
              equipment: (exercise?.equipment ?? e.equipment) as WE["equipment"],
              exercise: exercise
                ? ({
                    ...(e.exercise ?? {}),
                    id: exercise.id,
                    name: exercise.name,
                    equipment: exercise.equipment,
                    isTimed: exercise.isTimed ?? false,
                  } as WE["exercise"])
                : e.exercise,
            }
          : e,
      ),
    );
    outbox.assignExercise({ workoutExerciseId: weId, exerciseId });
  }

  function handleRemoveExercise(weId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== weId));
    outbox.removeWorkoutExercise(weId);
  }

  function handleAddSet(weId: string, opts?: { type?: SetType }) {
    const we = exercises.find((e) => e.id === weId);
    if (!we) return;
    const type = opts?.type ?? "NORMAL";
    const seed = seedSet(we, type, prev);
    const tempId = tmpSetId();
    const optimistic = {
      id: tempId,
      workoutExerciseId: weId,
      order: (we.sets.at(-1)?.order ?? -1) + 1,
      type,
      targetReps: we.targetReps ?? null,
      reps: seed.reps,
      seconds: null,
      weight: seed.weight,
      rpe: null,
    } as SetEntry;
    setExercises((list) =>
      list.map((e) => (e.id === weId ? { ...e, sets: [...e.sets, optimistic] } : e)),
    );
    outbox.addSet(tempId, { workoutExerciseId: weId, type });
  }

  function handleMoveExercise(weId: string, dir: -1 | 1) {
    const i = exercises.findIndex((e) => e.id === weId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= exercises.length) return;
    const next = [...exercises];
    [next[i], next[j]] = [next[j], next[i]];
    setExercises(next);
    outbox.reorderWorkoutExercises({
      workoutId: workout.id,
      orderedIds: next.map((e) => e.id),
    });
  }

  function handleDeleteSet(weId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === weId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
      ),
    );
    outbox.deleteSet(setId);
  }

  // Autosave: apply locally (done by the caller), queue for the server. The queue
  // retries on its own, so no toast on a transient failure.
  function saveSet(setId: string, patch: Partial<SetEntry>) {
    outbox.updateSet({
      setId,
      type: patch.type ?? undefined,
      reps: patch.reps,
      seconds: patch.seconds,
      weight: patch.weight,
    });
  }

  function saveExercise(
    weId: string,
    patch: { equipment?: string | null; linkToNext?: ExerciseLink | null },
  ) {
    outbox.updateWorkoutExercise({
      workoutExerciseId: weId,
      equipment: patch.equipment as never,
      linkToNext: patch.linkToNext,
    });
  }

  function handleFinish() {
    if (exercises.length === 0) {
      toast.error("Add at least one exercise first");
      return;
    }
    if (online && syncPending === 0) {
      clearSnapshot(workout.id);
      startTransition(() => finishWorkout(workout.id));
      return;
    }
    // Offline, or set writes still pending — queue the finish behind them.
    outbox.finishWorkout(workout.id);
    toast.success(
      online
        ? "Finishing up — syncing your sets…"
        : "Saved. It'll finish syncing when you're back online.",
    );
    clearSnapshot(workout.id);
    router.push("/dashboard");
  }

  function handleDiscard() {
    if (!confirm("Discard this workout and everything logged in it?")) return;
    if (!online) {
      toast.error("Reconnect to discard this workout.");
      return;
    }
    clearSnapshot(workout.id);
    startTransition(() => deleteWorkout(workout.id));
  }

  const pending = busy;

  const groups = React.useMemo(() => groupLinkedExercises(exercises), [exercises]);
  const working = exercises.flatMap((e) => e.sets.filter(isWorkingSet));
  const totalSets = working.length;
  const totalVolume = working.reduce((x, s) => x + s.reps * s.weight, 0);
  const doneCount = exercises.filter(isExerciseDone).length;

  return (
    <div className="flex flex-col gap-3">
      {(!online || syncPending > 0) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            online
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
          )}
        >
          {online ? (
            <RefreshCw className="size-4 shrink-0 animate-spin" />
          ) : (
            <CloudOff className="size-4 shrink-0" />
          )}
          <span>
            {online
              ? `Syncing ${syncPending} change${syncPending === 1 ? "" : "s"}…`
              : "Offline — your sets are saved on this device and will sync when you reconnect."}
          </span>
        </div>
      )}

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

      {exercises.length > 0 && (
        <p className="text-muted-foreground px-1 text-xs">
          Tap a set number to tag it — <b>W</b> warm-up (not counted) · <b>D</b> drop ·{" "}
          <b>F</b> failure.
        </p>
      )}

      {exercises.length === 0 && (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Nothing here yet — add an exercise or an open slot below.
        </p>
      )}

      {groups.map((group, gi) => {
        const cardProps = (we: WE) => ({
          we,
          index: exercises.findIndex((e) => e.id === we.id),
          total: exercises.length,
          unit,
          disabled: pending,
          catalog,
          prev,
          prevForExercise: we.exercise ? prev[we.exercise.id] : undefined,
          canMoveUp: exercises.findIndex((e) => e.id === we.id) > 0,
          canMoveDown: exercises.findIndex((e) => e.id === we.id) < exercises.length - 1,
          onMoveUp: () => handleMoveExercise(we.id, -1),
          onMoveDown: () => handleMoveExercise(we.id, 1),
          onRemove: () => handleRemoveExercise(we.id),
          onAddSet: () => handleAddSet(we.id),
          onAddDropSet: () => handleAddSet(we.id, { type: "DROP" }),
          onDeleteSet: (setId: string) => handleDeleteSet(we.id, setId),
          onPatchSet: (setId: string, patch: Partial<SetEntry>) =>
            patchSet(we.id, setId, patch),
          onSaveSet: saveSet,
          onAssign: (exerciseId: string, exercise?: PickerExercise) =>
            handleAssign(we.id, exerciseId, exercise),
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
          history={prev}
          allowOfflineCreate
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
  prev,
  prevForExercise,
  inGroup = false,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
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
  prev: PrevMap;
  prevForExercise?: ExercisePrev;
  inGroup?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAddSet: () => void;
  onAddDropSet: () => void;
  onDeleteSet: (setId: string) => void;
  onPatchSet: (setId: string, patch: Partial<SetEntry>) => void;
  onSaveSet: (setId: string, patch: Partial<SetEntry>) => void;
  onAssign: (exerciseId: string, exercise?: PickerExercise) => void | Promise<void>;
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

  // Exercises already finished when the logger loaded start collapsed; ones you
  // complete during the session stay open until you collapse them by hand.
  const [collapsed, setCollapsed] = React.useState(done && !inGroup);

  if (collapsed && we.exercise) {
    return (
      <Card size="sm" className={cn(inGroup && "shadow-none", "opacity-80")}>
        <CardHeader>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center gap-2 text-left"
            aria-label={`Expand ${we.exercise.name}`}
          >
            <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
              <Check className="size-3" />
            </span>
            <span className="font-heading min-w-0 flex-1 truncate font-medium">
              {we.exercise.name}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {collapsedSummary(we, unit)}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card size="sm" className={cn(inGroup && "shadow-none", done && "opacity-80")}>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {done && we.exercise ? (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-2 text-left"
                aria-label={`Collapse ${we.exercise.name}`}
              >
                <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3" />
                </span>
                <span className="font-heading font-medium">{we.exercise.name}</span>
                <ChevronUp className="text-muted-foreground size-4 shrink-0" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums">
                  {index + 1}
                </span>
                <span className="font-heading font-medium">
                  {we.exercise?.name ?? roleLabel(we.muscle, we.role)}
                </span>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              {we.muscle ? <Badge variant="secondary">{we.muscle}</Badge> : null}
              {we.role ? <Badge variant="ghost">{roleShort(we.role)}</Badge> : null}
              {timed ? <Badge variant="ghost">Timed</Badge> : null}
              {we.linkToNext ? (
                <Badge variant="outline">{LINK_LABELS[we.linkToNext]} → next</Badge>
              ) : null}
              {target ? <span className="text-muted-foreground">{target}</span> : null}
              <span className="text-muted-foreground/70 tabular-nums">
                {index + 1}/{total}
              </span>
            </div>
            {prevForExercise ? (
              <p className="text-muted-foreground/80 mt-1 truncate text-xs">
                Last time: {formatPrev(prevForExercise, unit, timed)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-0.5">
            {!inGroup && (canMoveUp || canMoveDown) ? (
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-4"
                  onClick={onMoveUp}
                  disabled={disabled || !canMoveUp}
                  aria-label="Move exercise up"
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-4"
                  onClick={onMoveDown}
                  disabled={disabled || !canMoveDown}
                  aria-label="Move exercise down"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </div>
            ) : null}
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
        </div>

        {unfilled ? (
          <ExercisePickerDialog
            catalog={catalog}
            history={prev}
            lockMuscle={we.muscle}
            title="Choose exercise"
            allowOfflineCreate
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
                history={prev}
                lockMuscle={we.muscle}
                title="Swap exercise"
                allowOfflineCreate
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
                  unit={unit}
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

/**
 * The compact set-type control. A radix Select on desktop; on phones a native
 * `<select>` (kept invisible over the coloured token) so the OS picker opens
 * full-width instead of a cramped menu in the corner.
 */
function SetTypeField({
  value,
  token,
  tone,
  label,
  onChange,
}: {
  value: SetType;
  token: React.ReactNode;
  tone: string;
  label: string;
  onChange: (type: SetType) => void;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("relative h-9 w-full", tone)}>
        <div
          aria-hidden
          className="border-input dark:bg-input/30 flex h-full w-full items-center justify-center rounded-md border px-1.5 text-sm font-semibold tabular-nums shadow-xs"
        >
          {token}
        </div>
        <select
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value as SetType)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {SET_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {SET_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={(v) => onChange(v as SetType)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn(
          "h-9 w-full justify-center px-1.5 font-semibold tabular-nums",
          tone,
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
  );
}

/**
 * Memoised so editing one set doesn't reconcile the other ~50 rows (each of
 * which mounts a radix Select + two WheelFields). The callbacks change identity
 * every parent render but only ever call functional-updater setState / the
 * module-level outbox, so ignoring their identity in the comparison is safe.
 */
const SetRow = React.memo(SetRowImpl, (a, b) => {
  return (
    a.set === b.set &&
    a.number === b.number &&
    a.unit === b.unit &&
    a.defaultReps === b.defaultReps &&
    a.timed === b.timed &&
    a.disabled === b.disabled
  );
});

function SetRowImpl({
  set,
  number,
  unit,
  defaultReps,
  timed,
  disabled,
  onPatch,
  onSave,
  onDelete,
}: {
  set: SetEntry;
  number: number | null;
  unit: "KG" | "LB";
  defaultReps: string | null;
  timed: boolean;
  disabled: boolean;
  onPatch: (patch: Partial<SetEntry>) => void;
  onSave: (patch: Partial<SetEntry>) => void;
  onDelete: () => void;
}) {
  const pending = React.useRef<Partial<SetEntry>>({});
  const timer = React.useRef<number | undefined>(undefined);

  // Only touch shared state once typing settles — so the volume / est-max /
  // progress readouts don't jitter on every keystroke.
  const flush = React.useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (Object.keys(pending.current).length) {
      const patch = { ...pending.current };
      pending.current = {};
      onPatch(patch);
      onSave(patch);
    }
  }, [onPatch, onSave]);

  // Save anything pending if the row unmounts (e.g. you navigate away mid-type).
  const flushRef = React.useRef(flush);
  React.useEffect(() => {
    flushRef.current = flush;
  });
  React.useEffect(() => () => flushRef.current(), []);

  function change(patch: Partial<SetEntry>) {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 450);
  }

  /** A single committed value (from the mobile picker) — save right away. */
  function commit(patch: Partial<SetEntry>) {
    onPatch(patch);
    onSave(patch);
  }

  const token = set.type === "NORMAL" ? (number ?? "•") : SET_TYPE_CODE[set.type];

  return (
    <div className="grid grid-cols-[3.25rem_1fr_1fr_1.75rem] items-center gap-2">
      <SetTypeField
        value={set.type}
        token={token}
        tone={SET_TYPE_TONE[set.type]}
        label={`Set type — ${SET_TYPE_LABELS[set.type]}`}
        onChange={(t) => {
          onPatch({ type: t });
          onSave({ type: t });
        }}
      />
      <WheelField
        kind="weight"
        value={set.weight}
        unit={unit}
        onInput={(w) => change({ weight: w })}
        onPick={(w) => commit({ weight: w })}
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
        <WheelField
          kind="reps"
          value={set.reps}
          unit={unit}
          placeholder={set.targetReps ?? defaultReps ?? ""}
          onInput={(r) => change({ reps: r })}
          onPick={(r) => commit({ reps: r })}
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
