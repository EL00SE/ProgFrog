"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EQUIPMENT_LABELS, MUSCLE_GROUPS } from "@/lib/training";
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
  custom,
}: {
  globals: GlobalExercise[];
  custom: CustomExercise[];
}) {
  const [query, setQuery] = React.useState("");

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
              <ExerciseRow key={e.id} exercise={e} editable />
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
}: {
  exercise: CustomExercise | GlobalExercise;
  editable?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const isArchived = "isArchived" in exercise && exercise.isArchived;

  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-2 py-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {exercise.name}
            {isArchived ? (
              <span className="text-muted-foreground"> (archived)</span>
            ) : null}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {exercise.muscle ? (
              <Badge variant="secondary">{exercise.muscle}</Badge>
            ) : null}
            <Badge variant="ghost">{EQUIPMENT_LABELS[exercise.equipment]}</Badge>
          </div>
        </div>
        {editable ? (
          <div className="flex shrink-0 gap-1">
            <ExerciseFormDialog
              exercise={exercise as CustomExercise}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={isArchived ? "Restore" : "Archive"}
              onClick={() =>
                startTransition(async () => {
                  await setExerciseArchived(exercise.id, !isArchived);
                  router.refresh();
                })
              }
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
}: {
  exercise?: CustomExercise;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(exercise?.name ?? "");
  const [equipment, setEquipment] = React.useState(exercise?.equipment ?? "BARBELL");
  const [muscle, setMuscle] = React.useState(exercise?.muscle ?? "Other");

  function submit() {
    startTransition(async () => {
      const payload = {
        name,
        equipment: equipment as never,
        muscle,
      };
      const res = exercise
        ? await updateCustomExercise({ id: exercise.id, ...payload })
        : await createCustomExercise(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(exercise ? "Exercise updated" : "Exercise added");
      setOpen(false);
      if (!exercise) setName("");
      router.refresh();
    });
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
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {exercise ? "Save" : "Add exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
