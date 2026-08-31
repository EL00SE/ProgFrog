"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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

type Slot = FullTemplate["days"][number]["exercises"][number];

const slotTitle = (s: Slot | undefined) =>
  s ? (s.exercise?.name ?? roleLabel(s.muscle, s.role)) : null;

export function TemplateEditor({
  template,
  catalog,
}: {
  template: FullTemplate;
  catalog: PickerExercise[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink href="/dashboard/templates">Templates</BackLink>
        <Input
          defaultValue={template.name}
          maxLength={80}
          aria-label="Template name"
          className="h-auto border-0 bg-transparent px-0 text-xl font-bold tracking-tight shadow-none focus-visible:ring-0 sm:text-2xl dark:bg-transparent"
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name && name !== template.name) {
              run(() => updateTemplate({ templateId: template.id, name }));
            }
          }}
        />
        <Textarea
          defaultValue={template.description ?? ""}
          placeholder="Notes about this split (optional)"
          maxLength={500}
          onBlur={(e) => {
            const description = e.target.value.trim();
            if (description !== (template.description ?? "")) {
              run(() =>
                updateTemplate({
                  templateId: template.id,
                  description: description || null,
                }),
              );
            }
          }}
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
                  if (name && name !== day.name) {
                    run(() => renameTemplateDay({ dayId: day.id, name }));
                  }
                }}
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || day.exercises.length === 0}
                  onClick={() =>
                    startTransition(() => startWorkoutFromTemplateDay(day.id))
                  }
                >
                  <Play className="size-4" /> Start workout
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending || template.days.length === 1}
                  aria-label="Remove day"
                  onClick={() => run(() => removeTemplateDay(day.id))}
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
                  disabled={pending}
                  run={run}
                />
              ))
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <ExercisePickerDialog
                catalog={catalog}
                onPick={(exerciseId) =>
                  run(() => addTemplateExercise({ dayId: day.id, exerciseId }))
                }
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4" /> Add exercise
                  </Button>
                }
              />
              <AddSlotDialog
                onAdd={(slot) =>
                  run(() => addTemplateExercise({ dayId: day.id, ...slot }))
                }
                trigger={
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4" /> Add slot
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => addTemplateDay(template.id))}
        >
          <Plus className="size-4" /> Add day
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete template "${template.name}"?`)) {
              startTransition(() => deleteTemplate(template.id));
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
  disabled,
  run,
}: {
  slot: Slot;
  nextName: string | null;
  catalog: PickerExercise[];
  disabled: boolean;
  run: (fn: () => Promise<unknown>) => void;
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
          onPick={(exerciseId) =>
            run(() => updateTemplateExercise({ id: te.id, exerciseId }))
          }
          trigger={
            <Button variant="ghost" size="sm" disabled={disabled}>
              <Repeat2 className="size-3.5" />
              {te.exercise ? "Change" : "Choose"}
            </Button>
          }
        />
        {te.exercise ? (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Clear exercise (keep the slot)"
            onClick={() =>
              run(() => updateTemplateExercise({ id: te.id, exerciseId: null }))
            }
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          aria-label="Remove slot"
          onClick={() => run(() => removeTemplateExercise(te.id))}
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
              const targetReps = e.target.value.trim() || null;
              if (targetReps !== te.targetReps) {
                run(() => updateTemplateExercise({ id: te.id, targetReps }));
              }
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
              disabled={disabled}
              canRemove={te.sets.length > 1}
              run={run}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            disabled={disabled}
            onClick={() => run(() => addTemplateSet(te.id))}
          >
            <Plus className="size-3.5" /> Add set
          </Button>
        </div>

        <Select
          value={link ?? "none"}
          onValueChange={(v) =>
            run(() =>
              updateTemplateExercise({
                id: te.id,
                linkToNext: v === "none" ? null : (v as ExerciseLink),
              }),
            )
          }
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

type PlannedSet = Slot["sets"][number];

function TemplateSetRow({
  set: ts,
  number,
  defaultReps,
  disabled,
  canRemove,
  run,
}: {
  set: PlannedSet;
  number: number;
  defaultReps: string | null;
  disabled: boolean;
  canRemove: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_8rem_1fr_1.75rem] items-center gap-2">
      <span className="text-muted-foreground text-xs tabular-nums">{number}</span>
      <Select
        value={ts.type}
        onValueChange={(v) =>
          run(() => updateTemplateSet({ id: ts.id, type: v as SetType }))
        }
      >
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
        disabled={disabled}
        onBlur={(e) => {
          const targetReps = e.target.value.trim() || null;
          if (targetReps !== (ts.targetReps ?? null)) {
            run(() => updateTemplateSet({ id: ts.id, targetReps }));
          }
        }}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled || !canRemove}
        aria-label="Remove set"
        onClick={() => run(() => removeTemplateSet(ts.id))}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
