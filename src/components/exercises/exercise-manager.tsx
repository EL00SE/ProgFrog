"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EQUIPMENT_LABELS, MUSCLE_GROUPS } from "@/lib/training";
import { cn } from "@/lib/utils";
import {
  createCustomExercise,
  setExerciseArchived,
  updateCustomExercise,
} from "@/lib/actions/exercises";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GlobalExercise = {
  id: string;
  name: string;
  equipment: string;
  muscle: string | null;
};
type CustomExercise = GlobalExercise & { isArchived: boolean };

function byMuscleThenName(a: GlobalExercise, b: GlobalExercise) {
  return (a.muscle ?? "~").localeCompare(b.muscle ?? "~") || a.name.localeCompare(b.name);
}

export function ExerciseManager({
  globals,
  custom: customProp,
}: {
  globals: GlobalExercise[];
  custom: CustomExercise[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  // Local mirror of the custom list so add / edit / archive land instantly. A
  // fresh server list (from the action's revalidate) replaces it on the next render.
  const [custom, setCustom] = React.useState(customProp);
  const [syncedProp, setSyncedProp] = React.useState(customProp);
  if (customProp !== syncedProp) {
    setCustom(customProp);
    setSyncedProp(customProp);
  }

  const reconcileOnError = React.useCallback(
    (e: unknown) => {
      console.error(e);
      toast.error("Couldn't save that — reverting");
      router.refresh();
    },
    [router],
  );

  const upsert = React.useCallback((row: CustomExercise) => {
    setCustom((list) => {
      const i = list.findIndex((e) => e.id === row.id);
      if (i === -1) return [...list, row];
      const next = [...list];
      next[i] = row;
      return next;
    });
  }, []);

  const toggleArchived = React.useCallback(
    (id: string, isArchived: boolean) => {
      setCustom((list) => list.map((e) => (e.id === id ? { ...e, isArchived } : e)));
      setExerciseArchived(id, isArchived).catch(reconcileOnError);
    },
    [reconcileOnError],
  );

  const q = query.trim().toLowerCase();
  const match = (e: GlobalExercise) =>
    !q ||
    e.name.toLowerCase().includes(q) ||
    (e.muscle?.toLowerCase().includes(q) ?? false);

  const filteredGlobals = globals.filter(match).sort(byMuscleThenName);
  const filteredCustom = custom.filter(match).sort(byMuscleThenName);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-44"
        />
        <ExerciseFormDialog
          onSaved={upsert}
          onError={reconcileOnError}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Add exercise
            </Button>
          }
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Your exercises ({custom.length})</h2>
        {filteredCustom.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {custom.length === 0
              ? "You haven't added any custom exercises yet."
              : "No matches."}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredCustom.map((e) => (
              <ExerciseRow
                key={e.id}
                exercise={e}
                editable
                onSaved={upsert}
                onError={reconcileOnError}
                onToggleArchived={toggleArchived}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">
          Catalog ({filteredGlobals.length}/{globals.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredGlobals.map((e) => (
            <ExerciseRow key={e.id} exercise={e} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ExerciseRow({
  exercise,
  editable = false,
  onSaved,
  onError,
  onToggleArchived,
}: {
  exercise: CustomExercise | GlobalExercise;
  editable?: boolean;
  onSaved?: (row: CustomExercise) => void;
  onError?: (e: unknown) => void;
  onToggleArchived?: (id: string, isArchived: boolean) => void;
}) {
  const isArchived = "isArchived" in exercise && exercise.isArchived;

  return (
    <Card size="sm" className="h-full py-0">
      <CardContent className="flex h-full items-center gap-2 py-1.5">
        <span
          className={cn(
            "truncate text-sm font-medium",
            isArchived && "text-muted-foreground",
          )}
        >
          {exercise.name}
          {isArchived ? " (archived)" : null}
        </span>
        {exercise.muscle ? (
          <Badge variant="secondary" className="shrink-0">
            {exercise.muscle}
          </Badge>
        ) : null}
        <span className="text-muted-foreground ms-auto shrink-0 text-xs">
          {EQUIPMENT_LABELS[exercise.equipment]}
        </span>
        {editable ? (
          <div className="-me-1 flex shrink-0">
            <ExerciseFormDialog
              exercise={exercise as CustomExercise}
              onSaved={onSaved}
              onError={onError}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isArchived ? "Restore" : "Archive"}
              onClick={() => onToggleArchived?.(exercise.id, !isArchived)}
            >
              {isArchived ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ExerciseFormDialog({
  exercise,
  trigger,
  onSaved,
  onError,
}: {
  exercise?: CustomExercise;
  trigger: React.ReactNode;
  onSaved?: (row: CustomExercise) => void;
  onError?: (e: unknown) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState(exercise?.name ?? "");
  const [equipment, setEquipment] = React.useState(exercise?.equipment ?? "BARBELL");
  const [muscle, setMuscle] = React.useState(exercise?.muscle ?? "Other");

  async function submit() {
    const payload = { name: name.trim(), equipment: equipment as never, muscle };
    if (!payload.name) return;
    setSaving(true);
    try {
      const res = exercise
        ? await updateCustomExercise({ id: exercise.id, ...payload })
        : await createCustomExercise(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSaved?.({ ...res.exercise, isArchived: exercise?.isArchived ?? false });
      toast.success(exercise ? "Exercise updated" : "Exercise added");
      setOpen(false);
      if (!exercise) setName("");
    } catch (e) {
      onError?.(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exercise ? "Edit exercise" : "New exercise"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input
              id="ex-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meadows Row"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Equipment</Label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger className="w-full">
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
          </div>
          <div className="grid gap-1.5">
            <Label>Muscle group</Label>
            <Select value={muscle} onValueChange={setMuscle}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {exercise ? "Save" : "Add exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
