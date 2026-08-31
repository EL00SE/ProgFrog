"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronUp,
  Copy,
  Loader2,
  Play,
  Plus,
  Repeat2,
  Trash2,
  X,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import type { FullTemplate } from "@/lib/queries/templates";
import {
  addTemplateDay,
  addTemplateExercise,
  addTemplateSet,
  deleteTemplate,
  duplicateTemplateDay,
  removeTemplateDay,
  removeTemplateExercise,
  removeTemplateSet,
  renameTemplateDay,
  reorderTemplateDays,
  reorderTemplateExercises,
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

/**
 * Animate direct children (each tagged `data-flip="<id>"`) when they change
 * position — a lightweight FLIP so reorders slide instead of jumping.
 */
function useFlip<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const positions = React.useRef(new Map<string, number>());
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.offsetHeight === 0) return; // hidden (collapsed) — skip
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const key = child.dataset.flip;
      if (!key) continue;
      const top = child.offsetTop;
      next.set(key, top);
      const prev = positions.current.get(key);
      if (!reduce && prev != null && prev !== top) {
        child.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }],
          { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
      }
    }
    positions.current = next;
  });
  return ref;
}

function FlipList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useFlip<HTMLDivElement>();
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Returns `isNew(id)` — true only on the first render an id appears in, so
 * freshly-added rows can play an enter animation without everything animating
 * on the initial page load.
 */
function useEnterAnimation(ids: string[]) {
  const seen = React.useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(ids);
  const isNew = (id: string) => !seen.current!.has(id);
  const markSeen = React.useCallback((id: string) => {
    seen.current!.add(id);
  }, []);
  React.useEffect(() => {
    ids.forEach((id) => seen.current!.add(id));
  });
  return { isNew, markSeen };
}

const enterCls =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-200";
const enterClsLight =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150";

function SaveStatus({ busy, savedAt }: { busy: boolean; savedAt: number | null }) {
  if (busy) {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <Check className="text-primary size-3.5" />
      {savedAt ? "Saved" : "Saves automatically"}
    </span>
  );
}

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
  catalog: initialCatalog,
}: {
  template: FT;
  catalog: PickerExercise[];
}) {
  const router = useRouter();
  const [template, setTemplate] = React.useState(initial);
  const [catalog, setCatalog] = React.useState(initialCatalog);
  // `adding` gates the create buttons for ~1s while a new row is persisted, so
  // there is never a second create racing an unsaved id. Edits never block.
  const [adding, startAdding] = React.useTransition();
  const [saving, startSaving] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  // Days start collapsed so a multi-day split is scannable on open.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(initial.days.map((d) => d.id)),
  );
  const toggleDay = (dayId: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  const { isNew: dayIsNew, markSeen: markDaySeen } = useEnterAnimation(
    template.days.map((d) => d.id),
  );
  // Edits made to a not-yet-saved (temp id) row are queued and replayed with the
  // real id once its create resolves.
  const queued = React.useRef(new Map<string, ((id: string) => Promise<unknown>)[]>());

  const persist = React.useCallback(
    (fn: () => Promise<unknown>) => {
      startSaving(async () => {
        try {
          await fn();
          setSavedAt(Date.now());
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
        markDaySeen(real.id);
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
  function duplicateDay(sourceId: string) {
    const src = template.days.find((d) => d.id === sourceId);
    if (!src) return;
    const tempId = tmpId();
    const clone: Day = {
      ...src,
      id: tempId,
      name: `${src.name} (copy)`.slice(0, 40),
      order: template.days.length,
      exercises: src.exercises.map((e) => {
        const eId = tmpId();
        return {
          ...e,
          id: eId,
          templateDayId: tempId,
          sets: e.sets.map((s) => ({ ...s, id: tmpId(), templateExerciseId: eId })),
        };
      }),
    };
    setTemplate((t) => ({ ...t, days: [...t.days, clone] }));
    startAdding(async () => {
      try {
        const real = (await duplicateTemplateDay(sourceId)) as Day;
        markDaySeen(real.id);
        setTemplate((t) => ({
          ...t,
          days: t.days.map((d) => (d.id === tempId ? real : d)),
        }));
        flushQueued(tempId, real.id);
      } catch {
        toast.error("Couldn't copy that day");
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
  function moveDay(dayId: string, dir: -1 | 1) {
    const i = template.days.findIndex((d) => d.id === dayId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= template.days.length) return;
    const days = [...template.days];
    [days[i], days[j]] = [days[j], days[i]];
    setTemplate((t) => ({ ...t, days }));
    persist(() =>
      reorderTemplateDays({ templateId: template.id, dayIds: days.map((d) => d.id) }),
    );
  }

  /** Keep a just-created exercise available for later picks in this session. */
  function rememberExercise(ex?: PickerExercise) {
    if (ex) setCatalog((c) => (c.some((x) => x.id === ex.id) ? c : [...c, ex]));
  }

  // --- slots ----------------------------------------------------------
  function addSlot(
    dayId: string,
    input: { exerciseId?: string; muscle?: string; role?: string },
    exercise?: PickerExercise,
  ) {
    rememberExercise(exercise);
    const tempId = tmpId();
    const picked =
      exercise ??
      (input.exerciseId
        ? (catalog.find((c) => c.id === input.exerciseId) ?? null)
        : null);
    const day = template.days.find((d) => d.id === dayId);
    const temp: Slot = {
      id: tempId,
      templateDayId: dayId,
      exerciseId: input.exerciseId ?? null,
      exercise: picked ? (picked as unknown as Slot["exercise"]) : null,
      muscle: (input.muscle ?? picked?.muscle ?? null) as Slot["muscle"],
      role: (input.role ?? null) as Slot["role"],
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
  function setSlotExercise(
    slotId: string,
    exerciseId: string | null,
    exercise?: PickerExercise,
  ) {
    rememberExercise(exercise);
    const picked =
      exercise ??
      (exerciseId ? (catalog.find((c) => c.id === exerciseId) ?? null) : null);
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
          } as Slot["exercise"])
        : null,
      muscle: s.muscle ?? picked?.muscle ?? null,
      role: s.role as Slot["role"],
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
  function moveSlot(dayId: string, slotId: string, dir: -1 | 1) {
    const day = template.days.find((d) => d.id === dayId);
    if (!day) return;
    const i = day.exercises.findIndex((e) => e.id === slotId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= day.exercises.length) return;
    const exercises = [...day.exercises];
    [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
    editDay(dayId, (d) => ({ ...d, exercises }));
    persist(() =>
      reorderTemplateExercises({ dayId, exerciseIds: exercises.map((e) => e.id) }),
    );
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
        <div className="flex items-center justify-between gap-2">
          <BackLink href="/dashboard/templates">Templates</BackLink>
          <div className="flex items-center gap-3">
            <SaveStatus busy={saving || adding} savedAt={savedAt} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/dashboard/templates")}
            >
              Done
            </Button>
          </div>
        </div>
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

      <FlipList className="flex flex-col gap-6">
        {template.days.map((day, di) => (
          <DayCard
            key={day.id}
            day={day}
            index={di}
            daysCount={template.days.length}
            isOpen={!collapsed.has(day.id)}
            isNew={dayIsNew(day.id)}
            catalog={catalog}
            locked={adding}
            onToggle={() => toggleDay(day.id)}
            onRename={(name) => renameDay(day.id, name)}
            onMoveUp={() => moveDay(day.id, -1)}
            onMoveDown={() => moveDay(day.id, 1)}
            onStartWorkout={() => startAdding(() => startWorkoutFromTemplateDay(day.id))}
            onDuplicate={() => duplicateDay(day.id)}
            onRemove={() => removeDay(day.id)}
            onAddSlot={(input, ex) => addSlot(day.id, input, ex)}
            onMoveSlot={(slotId, dir) => moveSlot(day.id, slotId, dir)}
            onSetSlotExercise={(slotId, id, ex) => setSlotExercise(slotId, id, ex)}
            onRemoveSlot={(slotId) => removeSlot(slotId)}
            onDefaultReps={(slotId, r) => setDefaultReps(slotId, r)}
            onLink={(slotId, l) => setLink(slotId, l)}
            onAddSet={(slotId) => addSet(slotId)}
            onSetType={(setId, t) => setSetType(setId, t)}
            onSetReps={(setId, r) => setSetReps(setId, r)}
            onRemoveSet={(slotId, setId) => removeSet(slotId, setId)}
          />
        ))}
      </FlipList>

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

type SlotInput = { exerciseId?: string; muscle?: string; role?: string };

function DayCard({
  day,
  index,
  daysCount,
  isOpen,
  isNew,
  catalog,
  locked,
  onToggle,
  onRename,
  onMoveUp,
  onMoveDown,
  onStartWorkout,
  onDuplicate,
  onRemove,
  onAddSlot,
  onMoveSlot,
  onSetSlotExercise,
  onRemoveSlot,
  onDefaultReps,
  onLink,
  onAddSet,
  onSetType,
  onSetReps,
  onRemoveSet,
}: {
  day: Day;
  index: number;
  daysCount: number;
  isOpen: boolean;
  isNew: boolean;
  catalog: PickerExercise[];
  locked: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onStartWorkout: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onAddSlot: (input: SlotInput, exercise?: PickerExercise) => void;
  onMoveSlot: (slotId: string, dir: -1 | 1) => void;
  onSetSlotExercise: (
    slotId: string,
    exerciseId: string | null,
    exercise?: PickerExercise,
  ) => void;
  onRemoveSlot: (slotId: string) => void;
  onDefaultReps: (slotId: string, targetReps: string | null) => void;
  onLink: (slotId: string, link: ExerciseLink | null) => void;
  onAddSet: (slotId: string) => void;
  onSetType: (setId: string, type: SetType) => void;
  onSetReps: (setId: string, targetReps: string | null) => void;
  onRemoveSet: (slotId: string, setId: string) => void;
}) {
  const { isNew: slotIsNew } = useEnterAnimation(day.exercises.map((e) => e.id));

  return (
    <Card
      data-flip={day.id}
      className={cn(
        "gap-0 py-4 transition-[padding] duration-200 motion-reduce:transition-none",
        !isOpen && "pb-0",
        isNew && enterCls,
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {daysCount > 1 ? (
              <MoveButtons
                disabled={locked}
                canUp={index > 0}
                canDown={index < daysCount - 1}
                onUp={onMoveUp}
                onDown={onMoveDown}
                label="day"
              />
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isOpen ? "Collapse day" : "Expand day"}
              aria-expanded={isOpen}
              onClick={onToggle}
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  !isOpen && "-rotate-90",
                )}
              />
            </Button>
            {isOpen ? (
              <Input
                defaultValue={day.name}
                maxLength={40}
                className="h-8 max-w-[12rem] font-medium"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== day.name) onRename(name);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={onToggle}
                className="truncate text-left text-sm font-medium"
              >
                {day.name}
                <span className="text-muted-foreground ml-2 font-normal">
                  {day.exercises.length}{" "}
                  {day.exercises.length === 1 ? "exercise" : "exercises"}
                </span>
              </button>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={locked || day.exercises.length === 0}
              onClick={onStartWorkout}
            >
              <Play className="size-4" /> Start workout
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={locked}
              aria-label="Duplicate day"
              title="Copy this day as a new day"
              onClick={onDuplicate}
            >
              <Copy className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={daysCount === 1}
              aria-label="Remove day"
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="flex flex-col gap-2 pt-4">
            {day.exercises.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No exercises yet — add one below.
              </p>
            ) : (
              <FlipList className="flex flex-col gap-2">
                {day.exercises.map((te, i) => (
                  <SlotRow
                    key={te.id}
                    flipKey={te.id}
                    enter={slotIsNew(te.id)}
                    slot={te}
                    nextName={slotTitle(day.exercises[i + 1])}
                    catalog={catalog}
                    locked={locked}
                    canUp={i > 0}
                    canDown={i < day.exercises.length - 1}
                    onMoveUp={() => onMoveSlot(te.id, -1)}
                    onMoveDown={() => onMoveSlot(te.id, 1)}
                    onSetExercise={(id, ex) => onSetSlotExercise(te.id, id, ex)}
                    onRemove={() => onRemoveSlot(te.id)}
                    onDefaultReps={(r) => onDefaultReps(te.id, r)}
                    onLink={(l) => onLink(te.id, l)}
                    onAddSet={() => onAddSet(te.id)}
                    onSetType={(setId, t) => onSetType(setId, t)}
                    onSetReps={(setId, r) => onSetReps(setId, r)}
                    onRemoveSet={(setId) => onRemoveSet(te.id, setId)}
                  />
                ))}
              </FlipList>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <ExercisePickerDialog
                catalog={catalog}
                onPick={(exerciseId, ex) => onAddSlot({ exerciseId }, ex)}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4" /> Add exercise
                  </Button>
                }
              />
              <AddSlotDialog
                onAdd={(slot) => onAddSlot(slot)}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4" /> Add slot
                  </Button>
                }
              />
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

/** Stacked up/down reorder control (tap-based — no drag needed on mobile). */
function MoveButtons({
  disabled,
  canUp,
  canDown,
  onUp,
  onDown,
  label,
}: {
  disabled: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-4"
        disabled={disabled || !canUp}
        aria-label={`Move ${label} up`}
        onClick={onUp}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="h-4"
        disabled={disabled || !canDown}
        aria-label={`Move ${label} down`}
        onClick={onDown}
      >
        <ChevronDown className="size-3.5" />
      </Button>
    </div>
  );
}

function SlotRow({
  slot: te,
  flipKey,
  enter,
  nextName,
  catalog,
  locked,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
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
  flipKey: string;
  enter: boolean;
  nextName: string | null;
  catalog: PickerExercise[];
  locked: boolean;
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSetExercise: (exerciseId: string | null, exercise?: PickerExercise) => void;
  onRemove: () => void;
  onDefaultReps: (targetReps: string | null) => void;
  onLink: (link: ExerciseLink | null) => void;
  onAddSet: () => void;
  onSetType: (setId: string, type: SetType) => void;
  onSetReps: (setId: string, targetReps: string | null) => void;
  onRemoveSet: (setId: string) => void;
}) {
  const link = te.linkToNext as ExerciseLink | null;
  const { isNew: setIsNew } = useEnterAnimation(te.sets.map((s) => s.id));
  return (
    <div
      data-flip={flipKey}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-2",
        link && "border-l-primary/60 border-l-4",
        enter && enterClsLight,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <MoveButtons
          disabled={locked}
          canUp={canUp}
          canDown={canDown}
          onUp={onMoveUp}
          onDown={onMoveDown}
          label="exercise"
        />
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
          title={te.exercise ? "Change exercise" : "Choose exercise"}
          onPick={(exerciseId, ex) => onSetExercise(exerciseId, ex)}
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
              enter={setIsNew(ts.id)}
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
  enter,
  defaultReps,
  canRemove,
  onType,
  onReps,
  onRemove,
}: {
  set: PlannedSet;
  number: number;
  enter: boolean;
  defaultReps: string | null;
  canRemove: boolean;
  onType: (type: SetType) => void;
  onReps: (targetReps: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1.25rem_8rem_1fr_1.75rem] items-center gap-2",
        enter && enterClsLight,
      )}
    >
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
