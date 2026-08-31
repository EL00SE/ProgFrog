"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsDown, Play, Plus, Repeat2, Trash2, X } from "lucide-react";

import {
  EQUIPMENT_LABELS,
  type ExerciseLink,
  LINK_HINTS,
  LINK_LABELS,
  LINK_OPTION_LABELS,
  roleLabel,
  roleShort,
  SET_TYPE_LABELS,
  SET_TYPE_SHORT,
  SET_TYPE_VALUES,
  type SetType,
} from "@/lib/training";
import type { FullTemplate } from "@/lib/queries/templates";
import {
  addTemplateDay,
  addTemplateExercise,
  addTemplateSet,
  deleteTemplate,
  removeTemplateDay,
  removeTemplateExercise,
  removeTemplateSet,
  renameTemplateDay,
  updateTemplate,
  updateTemplateExercise,
  updateTemplateSet,
} from "@/lib/actions/templates";
import { startWorkoutFromTemplateDay } from "@/lib/actions/workouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackLink } from "@/components/back-link";
import { AddSlotDialog } from "@/components/workout/add-slot-dialog";
import {
  ExercisePickerDialog,
  type PickerExercise,
} from "@/components/workout/exercise-picker-dialog";

type FT = FullTemplate;
type Day = FT["days"][number];
type Slot = Day["exercises"][number];
type PlannedSet = Slot["sets"][number];

const slotTitle = (s: Slot | undefined) =>
  s ? (s.exercise?.name ?? roleLabel(s.muscle, s.role)) : null;

let tmpSeq = 0;
const tmpId = () => `tmp_${Date.now().toString(36)}_${tmpSeq++}`;

/** Replace an optimistic slot with the saved one, keeping any edits the user
 *  made to its sets in the meantime (matched by position). */
function swapSlot(t: FT, tempId: string, real: Slot, tempSets: Slot["sets"]): FT {
  return {
    ...t,
    days: t.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        if (e.id !== tempId) return e;
        return {
          ...real,
          sets: real.sets.map((rs, i) => {
            const local = e.sets.find((x) => x.id === tempSets[i]?.id) ?? tempSets[i];
            return local ? { ...rs, type: local.type, targetReps: local.targetReps } : rs;
          }),
        };
      }),
    })),
  };
}

/**
 * Editor for one template. Every change updates local state immediately and
 * persists in the background — no full-page refetch, so it feels instant. On a
 * save error we reload to resync with the server.
 */
export function TemplateEditor({
  template: initial,
  catalog,
}: {
  template: FT;
  catalog: PickerExercise[];
}) {
  const router = useRouter();
  const [template, setTemplate] = React.useState(initial);
  // `adding` gates the create buttons for ~1s while a new row is persisted, so
  // there is never a second create racing an unsaved id. Edits never block.
  const [adding, startAdding] = React.useTransition();
  const [, startSaving] = React.useTransition();
  // Edits made to a not-yet-saved (temp id) row are queued and replayed with the
  // real id once its create resolves.
  const queued = React.useRef(new Map<string, ((id: string) => Promise<unknown>)[]>());

  const persist = React.useCallback(
    (fn: () => Promise<unknown>) => {
      startSaving(async () => {
        try {
          await fn();
        } catch {
          toast.error("Couldn't save that change — reloading");
          router.refresh();
        }
      });
    },
    [router],
  );

  /** Persist an edit now, or queue it if the row's id isn't real yet. */
  const persistFor = React.useCallback(
    (id: string, make: (id: string) => Promise<unknown>) => {
      if (id.startsWith("tmp_")) {
        queued.current.set(id, [...(queued.current.get(id) ?? []), make]);
      } else {
        persist(() => make(id));
      }
    },
    [persist],
  );

  const flushQueued = React.useCallback(
    (tempId: string, realId: string) => {
      const q = queued.current.get(tempId);
      queued.current.delete(tempId);
      q?.forEach((make) => persist(() => make(realId)));
    },
    [persist],
  );

  // --- local, immutable mutators -----------------------------------------
  const patchTemplate = (p: Partial<FT>) => setTemplate((t) => ({ ...t, ...p }));
  const editDay = (dayId: string, fn: (d: Day) => Day) =>
    setTemplate((t) => ({
      ...t,
      days: t.days.map((d) => (d.id === dayId ? fn(d) : d)),
    }));
  const editSlot = (slotId: string, fn: (s: Slot) => Slot) =>
    setTemplate((t) => ({
      ...t,
      days: t.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((e) => (e.id === slotId ? fn(e) : e)),
      })),
    }));
  const editSet = (setId: string, fn: (s: PlannedSet) => PlannedSet) =>
    setTemplate((t) => ({
      ...t,
      days: t.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => (s.id === setId ? fn(s) : s)),
        })),
      })),
    }));

  // --- template ---------------------------------------------------------
  function renameTemplate(name: string) {
    if (!name || name === template.name) return;
    patchTemplate({ name });
    persist(() => updateTemplate({ templateId: template.id, name }));
  }
  function setDescription(next: string | null) {
    if ((next ?? null) === (template.description ?? null)) return;
    patchTemplate({ description: next });
    persist(() => updateTemplate({ templateId: template.id, description: next }));
  }

  // --- days ------------------------------------------------------------
  function addDay() {
    const tempId = tmpId();
    const order = template.days.length;
    const temp: Day = {
      id: tempId,
      templateId: template.id,
      name: `Day ${order + 1}`,
      order,
      exercises: [],
    };
    setTemplate((t) => ({ ...t, days: [...t.days, temp] }));
    startAdding(async () => {
      try {
        const real = (await addTemplateDay(template.id)) as Day;
        setTemplate((t) => ({
          ...t,
          days: t.days.map((d) => (d.id === tempId ? real : d)),
        }));
        flushQueued(tempId, real.id);
      } catch {
        toast.error("Couldn't add a day");
        setTemplate((t) => ({ ...t, days: t.days.filter((d) => d.id !== tempId) }));
      }
    });
  }
  function renameDay(dayId: string, name: string) {
    editDay(dayId, (d) => ({ ...d, name }));
    persistFor(dayId, (id) => renameTemplateDay({ dayId: id, name }));
  }
  function removeDay(dayId: string) {
    setTemplate((t) => ({ ...t, days: t.days.filter((d) => d.id !== dayId) }));
    persist(() => removeTemplateDay(dayId));
  }

  // --- slots ----------------------------------------------------------
  function addSlot(
    dayId: string,
    input: { exerciseId?: string; muscle?: string; role?: string },
  ) {
    const tempId = tmpId();
    const picked = input.exerciseId
      ? (catalog.find((c) => c.id === input.exerciseId) ?? null)
      : null;
    const day = template.days.find((d) => d.id === dayId);
    const temp: Slot = {
      id: tempId,
      templateDayId: dayId,
      exerciseId: input.exerciseId ?? null,
      exercise: picked ? (picked as unknown as Slot["exercise"]) : null,
      muscle: (input.muscle ?? picked?.muscle ?? null) as Slot["muscle"],
      role: (input.role ?? picked?.role ?? null) as Slot["role"],
      order: day?.exercises.length ?? 0,
      targetReps: "8-12",
      linkToNext: null,
      sets: [0, 1, 2].map(
        (o) =>
          ({
            id: tmpId(),
            templateExerciseId: tempId,
            order: o,
            type: "NORMAL",
            targetReps: null,
          }) as PlannedSet,
      ),
    };
    editDay(dayId, (d) => ({ ...d, exercises: [...d.exercises, temp] }));
    startAdding(async () => {
      try {
        const real = (await addTemplateExercise({ dayId, ...input })) as Slot;
        setTemplate((t) => swapSlot(t, tempId, real, temp.sets));
        flushQueued(tempId, real.id);
        temp.sets.forEach((ts, i) => flushQueued(ts.id, real.sets[i]?.id ?? ts.id));
      } catch {
        toast.error("Couldn't add that");
        editDay(dayId, (d) => ({
          ...d,
          exercises: d.exercises.filter((e) => e.id !== tempId),
        }));
      }
    });
  }
  function setSlotExercise(slotId: string, exerciseId: string | null) {
    const picked = exerciseId ? (catalog.find((c) => c.id === exerciseId) ?? null) : null;
    editSlot(slotId, (s) => ({
      ...s,
      exerciseId,
      exercise: picked
        ? ({
            ...(s.exercise ?? {}),
            id: picked.id,
            name: picked.name,
            equipment: picked.equipment,
            muscle: picked.muscle,
            role: picked.role,
          } as Slot["exercise"])
        : null,
      muscle: s.muscle ?? picked?.muscle ?? null,
      role: (s.role ?? picked?.role ?? null) as Slot["role"],
    }));
    persistFor(slotId, (id) => updateTemplateExercise({ id, exerciseId }));
  }
  function removeSlot(slotId: string) {
    setTemplate((t) => ({
      ...t,
      days: t.days.map((d) => ({
        ...d,
        exercises: d.exercises.filter((e) => e.id !== slotId),
      })),
    }));
    persist(() => removeTemplateExercise(slotId));
  }
  function setDefaultReps(slotId: string, targetReps: string | null) {
    editSlot(slotId, (s) => ({ ...s, targetReps }));
    persistFor(slotId, (id) => updateTemplateExercise({ id, targetReps }));
  }
  function setLink(slotId: string, linkToNext: ExerciseLink | null) {
    editSlot(slotId, (s) => ({ ...s, linkToNext }));
    persistFor(slotId, (id) => updateTemplateExercise({ id, linkToNext }));
  }

  // --- planned sets ---------------------------------------------------
  function addSet(slotId: string) {
    const tempId = tmpId();
    const slot = template.days.flatMap((d) => d.exercises).find((e) => e.id === slotId);
    const last = slot?.sets.at(-1);
    const temp: PlannedSet = {
      id: tempId,
      templateExerciseId: slotId,
      order: (last?.order ?? -1) + 1,
      type: last?.type ?? "NORMAL",
      targetReps: null,
    };
    editSlot(slotId, (s) => ({ ...s, sets: [...s.sets, temp] }));
    startAdding(async () => {
      try {
        const real = (await addTemplateSet(slotId)) as PlannedSet;
        editSlot(slotId, (s) => ({
          ...s,
          sets: s.sets.map((x) => (x.id === tempId ? { ...x, id: real.id } : x)),
        }));
        flushQueued(tempId, real.id);
      } catch {
        toast.error("Couldn't add a set");
        editSlot(slotId, (s) => ({
          ...s,
          sets: s.sets.filter((x) => x.id !== tempId),
        }));
      }
    });
  }
  function setSetType(setId: string, type: SetType) {
    editSet(setId, (s) => ({ ...s, type }));
    persistFor(setId, (id) => updateTemplateSet({ id, type }));
  }
  function setSetReps(setId: string, targetReps: string | null) {
    editSet(setId, (s) => ({ ...s, targetReps }));
    persistFor(setId, (id) => updateTemplateSet({ id, targetReps }));
  }
  function removeSet(slotId: string, setId: string) {
    editSlot(slotId, (s) => ({ ...s, sets: s.sets.filter((x) => x.id !== setId) }));
    persist(() => removeTemplateSet(setId));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink href="/dashboard/templates">Templates</BackLink>
        <Input
          defaultValue={template.name}
          maxLength={80}
          aria-label="Template name"
          className="h-auto border-0 bg-transparent px-0 text-xl font-bold tracking-tight shadow-none focus-visible:ring-0 sm:text-2xl dark:bg-transparent"
          onBlur={(e) => renameTemplate(e.target.value.trim())}
        />
        <Textarea
          defaultValue={template.description ?? ""}
          placeholder="Notes about this split (optional)"
          maxLength={500}
          onBlur={(e) => setDescription(e.target.value.trim() || null)}
        />
      </div>

      {template.days.map((day) => (
        <Card key={day.id}>
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <Input
                defaultValue={day.name}
                maxLength={40}
                className="h-8 max-w-[12rem] font-medium"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== day.name) renameDay(day.id, name);
                }}
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={adding || day.exercises.length === 0}
                  onClick={() => startAdding(() => startWorkoutFromTemplateDay(day.id))}
                >
                  <Play className="size-4" /> Start workout
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={template.days.length === 1}
                  aria-label="Remove day"
                  onClick={() => removeDay(day.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {day.exercises.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No slots yet — add an exercise or an open slot below.
              </p>
            ) : (
              day.exercises.map((te, i) => (
                <SlotRow
                  key={te.id}
                  slot={te}
                  nextName={slotTitle(day.exercises[i + 1])}
                  catalog={catalog}
                  locked={adding}
                  onSetExercise={(id) => setSlotExercise(te.id, id)}
                  onRemove={() => removeSlot(te.id)}
                  onDefaultReps={(r) => setDefaultReps(te.id, r)}
                  onLink={(l) => setLink(te.id, l)}
                  onAddSet={() => addSet(te.id)}
                  onSetType={(setId, t) => setSetType(setId, t)}
                  onSetReps={(setId, r) => setSetReps(setId, r)}
                  onRemoveSet={(setId) => removeSet(te.id, setId)}
                />
              ))
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <ExercisePickerDialog
                catalog={catalog}
                onPick={(exerciseId) => addSlot(day.id, { exerciseId })}
                trigger={
                  <Button variant="ghost" size="sm" disabled={adding}>
                    <Plus className="size-4" /> Add exercise
                  </Button>
                }
              />
              <AddSlotDialog
                onAdd={(slot) => addSlot(day.id, slot)}
                trigger={
                  <Button variant="ghost" size="sm" disabled={adding}>
                    <Plus className="size-4" /> Add slot
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={adding} onClick={addDay}>
          <Plus className="size-4" /> Add day
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={adding}
          onClick={() => {
            if (confirm(`Delete template "${template.name}"?`)) {
              startAdding(() => deleteTemplate(template.id));
            }
          }}
        >
          <Trash2 className="size-4" /> Delete template
        </Button>
      </div>
    </div>
  );
}

function SlotRow({
  slot: te,
  nextName,
  catalog,
  locked,
  onSetExercise,
  onRemove,
  onDefaultReps,
  onLink,
  onAddSet,
  onSetType,
  onSetReps,
  onRemoveSet,
}: {
  slot: Slot;
  nextName: string | null;
  catalog: PickerExercise[];
  locked: boolean;
  onSetExercise: (exerciseId: string | null) => void;
  onRemove: () => void;
  onDefaultReps: (targetReps: string | null) => void;
  onLink: (link: ExerciseLink | null) => void;
  onAddSet: () => void;
  onSetType: (setId: string, type: SetType) => void;
  onSetReps: (setId: string, targetReps: string | null) => void;
  onRemoveSet: (setId: string) => void;
}) {
  const link = te.linkToNext as ExerciseLink | null;
  return (
    <div
      className={
        "flex flex-col gap-2 rounded-lg border p-2" +
        (link ? " border-l-primary/60 border-l-4" : "")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[8rem] flex-1">
          <p className="text-sm font-medium">
            {te.exercise?.name ?? roleLabel(te.muscle, te.role)}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {te.muscle ? <Badge variant="secondary">{te.muscle}</Badge> : null}
            {te.role ? <Badge variant="ghost">{roleShort(te.role)}</Badge> : null}
            {te.exercise ? (
              <Badge variant="ghost">{EQUIPMENT_LABELS[te.exercise.equipment]}</Badge>
            ) : null}
          </div>
        </div>

        <ExercisePickerDialog
          catalog={catalog}
          lockMuscle={te.muscle}
          lockRole={te.role}
          title={te.exercise ? "Change exercise" : "Choose exercise"}
          onPick={(exerciseId) => onSetExercise(exerciseId)}
          trigger={
            <Button variant="ghost" size="sm">
              <Repeat2 className="size-3.5" />
              {te.exercise ? "Change" : "Choose"}
            </Button>
          }
        />
        {te.exercise ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear exercise (keep the slot)"
            onClick={() => onSetExercise(null)}
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Remove slot"
          disabled={locked}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-muted-foreground flex w-fit items-center gap-1.5 text-xs">
          Default reps
          <Input
            defaultValue={te.targetReps ?? ""}
            placeholder="8-12"
            maxLength={20}
            className="h-7 w-20"
            onBlur={(e) => {
              const next = e.target.value.trim() || null;
              if (next !== (te.targetReps ?? null)) onDefaultReps(next);
            }}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="text-muted-foreground grid grid-cols-[1.25rem_8rem_1fr_1.75rem] items-center gap-2 text-[0.7rem] font-medium">
            <span />
            <span>Set type</span>
            <span>Reps</span>
            <span />
          </div>
          {te.sets.map((ts, i) => (
            <TemplateSetRow
              key={ts.id}
              set={ts}
              number={i + 1}
              defaultReps={te.targetReps}
              canRemove={te.sets.length > 1 && !locked}
              onType={(t) => onSetType(ts.id, t)}
              onReps={(r) => onSetReps(ts.id, r)}
              onRemove={() => onRemoveSet(ts.id)}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            disabled={locked}
            onClick={onAddSet}
          >
            <Plus className="size-3.5" /> Add set
          </Button>
        </div>

        <Select
          value={link ?? "none"}
          onValueChange={(v) => onLink(v === "none" ? null : (v as ExerciseLink))}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-72"
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
      </div>

      {link ? (
        <div className="text-muted-foreground flex items-start gap-1.5 border-t pt-2 text-xs">
          <ChevronsDown className="mt-px size-3.5 shrink-0" />
          {nextName ? (
            <span>
              <span className="text-foreground font-medium">{LINK_LABELS[link]}</span>{" "}
              with <span className="text-foreground font-medium">{nextName}</span> —{" "}
              {LINK_HINTS[link]}
            </span>
          ) : (
            <span>
              <span className="text-foreground font-medium">{LINK_LABELS[link]}</span>{" "}
              set, but there&rsquo;s no exercise after this one yet. Add the next exercise
              below to pair with it.
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TemplateSetRow({
  set: ts,
  number,
  defaultReps,
  canRemove,
  onType,
  onReps,
  onRemove,
}: {
  set: PlannedSet;
  number: number;
  defaultReps: string | null;
  canRemove: boolean;
  onType: (type: SetType) => void;
  onReps: (targetReps: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_8rem_1fr_1.75rem] items-center gap-2">
      <span className="text-muted-foreground text-xs tabular-nums">{number}</span>
      <Select value={ts.type} onValueChange={(v) => onType(v as SetType)}>
        <SelectTrigger size="sm" className="w-full" aria-label="Set type">
          <SelectValue>{SET_TYPE_SHORT[ts.type]}</SelectValue>
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
        defaultValue={ts.targetReps ?? ""}
        placeholder={defaultReps ?? "8-12"}
        maxLength={20}
        className="h-8"
        onBlur={(e) => {
          const next = e.target.value.trim() || null;
          if (next !== (ts.targetReps ?? null)) onReps(next);
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!canRemove}
        aria-label="Remove set"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
