"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  EQUIPMENT_LABELS,
  MUSCLE_GROUPS,
  ROLE_LABELS,
  ROLE_ORDER,
  ROLE_VALUES,
  roleShort,
} from "@/lib/training";
import { createCustomExercise } from "@/lib/actions/exercises";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

export type PickerExercise = {
  id: string;
  name: string;
  equipment: string;
  muscle: string | null;
  role: string | null;
};

export function ExercisePickerDialog({
  catalog,
  onPick,
  trigger,
  lockMuscle,
  lockRole,
  title = "Add exercise",
}: {
  catalog: PickerExercise[];
  onPick: (exerciseId: string) => void | Promise<void>;
  trigger: React.ReactNode;
  lockMuscle?: string | null;
  lockRole?: string | null;
  title?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [newEquipment, setNewEquipment] = React.useState("BARBELL");
  const [newMuscle, setNewMuscle] = React.useState<string>(lockMuscle || "Other");
  const [newRole, setNewRole] = React.useState<string>(lockRole || "SECONDARY");

  const locked = !showAll && (lockMuscle || lockRole);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog;
    if (locked) {
      list = list.filter(
        (e) =>
          (!lockMuscle || e.muscle === lockMuscle) && (!lockRole || e.role === lockRole),
      );
    }
    if (q) {
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.muscle?.toLowerCase().includes(q),
      );
    }
    const groups = new Map<string, PickerExercise[]>();
    for (const e of list) {
      const key = e.muscle ?? "Other";
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([m, items]) =>
          [
            m,
            [...items].sort(
              (a, b) =>
                (ROLE_ORDER[a.role ?? ""] ?? 9) - (ROLE_ORDER[b.role ?? ""] ?? 9) ||
                a.name.localeCompare(b.name),
            ),
          ] as const,
      );
  }, [catalog, query, locked, lockMuscle, lockRole]);

  const exactMatch = catalog.some(
    (e) => e.name.toLowerCase() === query.trim().toLowerCase(),
  );

  function reset() {
    setQuery("");
    setCreating(false);
    setShowAll(false);
    setNewMuscle(lockMuscle || "Other");
    setNewRole(lockRole || "SECONDARY");
  }

  function pick(id: string) {
    startTransition(async () => {
      await onPick(id);
      setOpen(false);
      reset();
    });
  }

  function handleCreate() {
    const name = query.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createCustomExercise({
        name,
        equipment: newEquipment as never,
        muscle: newMuscle,
        role: newRole as never,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added "${res.exercise.name}"`);
      await onPick(res.exercise.id);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[85dvh] flex-col gap-3 overflow-hidden sm:h-auto sm:max-h-[80dvh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {(lockMuscle || lockRole) && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">
              {[lockMuscle, lockRole && roleShort(lockRole)].filter(Boolean).join(" · ")}
            </Badge>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              {showAll ? "match the slot" : "show all exercises"}
            </button>
          </div>
        )}

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            autoFocus
            placeholder="Search or type a new name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {creating ? (
          <div className="flex flex-col gap-3 overflow-y-auto rounded-lg border p-3">
            <p className="text-sm font-medium">
              New exercise: <span className="text-muted-foreground">{query.trim()}</span>
            </p>
            <div className="grid gap-1.5">
              <Label>Equipment</Label>
              <Select value={newEquipment} onValueChange={setNewEquipment}>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Muscle</Label>
                <Select value={newMuscle} onValueChange={setNewMuscle}>
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
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_VALUES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={pending}>
                Create & add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreating(false)}
                disabled={pending}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
            {query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium"
              >
                <Plus className="size-4" />
                Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
            {filtered.map(([muscle, items]) => (
              <div key={muscle} className="mb-2">
                <p className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
                  {muscle}
                </p>
                {items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={pending}
                    onClick={() => pick(e.id)}
                    className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-50"
                  >
                    <span className="truncate">{e.name}</span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                      {e.role ? <span>{roleShort(e.role)}</span> : null}
                      <span>·</span>
                      <span>{EQUIPMENT_LABELS[e.equipment]}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-muted-foreground p-2 text-sm">
                {query.trim()
                  ? "No matches."
                  : locked
                    ? "Nothing tagged for this slot yet — type a name to add one."
                    : "No exercises yet."}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
