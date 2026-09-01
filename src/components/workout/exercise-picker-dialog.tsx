"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { EQUIPMENT_LABELS, formatDate, MUSCLE_GROUPS } from "@/lib/training";
import { createCustomExercise } from "@/lib/actions/exercises";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { outbox, useOutboxStatus } from "@/lib/offline-queue";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  isTimed?: boolean;
};

export function ExercisePickerDialog({
  catalog,
  history,
  onPick,
  trigger,
  lockMuscle,
  title = "Add exercise",
  allowOfflineCreate = false,
}: {
  catalog: PickerExercise[];
  /** last-done date per exercise id — surfaces recents and dates in the list */
  history?: Record<string, { date: string }>;
  /** `exercise` is passed when it was just created, so callers can show it
   *  without waiting for a refetched catalog. */
  onPick: (exerciseId: string, exercise?: PickerExercise) => void | Promise<void>;
  trigger: React.ReactNode;
  lockMuscle?: string | null;
  title?: string;
  /** In the workout logger a new exercise can be created offline (queued);
   *  elsewhere (template editor) it still needs a connection. */
  allowOfflineCreate?: boolean;
}) {
  const { online } = useOutboxStatus();
  const isMobile = useIsMobile();
  const hist = history ?? {};
  const lastDone = (id: string) => hist[id]?.date ?? null;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [newEquipment, setNewEquipment] = React.useState("BARBELL");
  const [newMuscle, setNewMuscle] = React.useState<string>(lockMuscle || "Other");

  const locked = !showAll && !!lockMuscle;

  const inScope = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog;
    if (locked && lockMuscle) {
      list = list.filter((e) => e.muscle === lockMuscle);
    }
    if (q) {
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.muscle?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [catalog, query, locked, lockMuscle]);

  // Exercises the user has done, most recent first — shown up top.
  const recent = React.useMemo(
    () =>
      inScope
        .filter((e) => lastDone(e.id))
        .sort((a, b) => (lastDone(b.id)! < lastDone(a.id)! ? -1 : 1))
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inScope, history],
  );

  const filtered = React.useMemo(() => {
    const groups = new Map<string, PickerExercise[]>();
    for (const e of inScope) {
      const key = e.muscle ?? "Other";
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([m, items]) =>
          [
            m,
            [...items].sort((a, b) => {
              // done exercises first (most recent), then by name
              const da = lastDone(a.id);
              const db = lastDone(b.id);
              if (da && db) return db < da ? -1 : 1;
              if (da) return -1;
              if (db) return 1;
              return a.name.localeCompare(b.name);
            }),
          ] as const,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inScope, history]);

  const exactMatch = catalog.some(
    (e) => e.name.toLowerCase() === query.trim().toLowerCase(),
  );

  function reset() {
    setQuery("");
    setCreating(false);
    setShowAll(false);
    setNewMuscle(lockMuscle || "Other");
  }

  function pick(id: string, exercise?: PickerExercise) {
    // Fire-and-forget (never in a transition — that would defer the caller's
    // optimistic update) and close.
    Promise.resolve(onPick(id, exercise)).catch(() => {});
    setOpen(false);
    reset();
  }

  function handleCreate() {
    const name = query.trim();
    if (!name) return;

    if (!online) {
      if (!allowOfflineCreate) {
        toast.error("Reconnect to add a brand-new exercise.");
        return;
      }
      // Optimistic: hand the caller a temp exercise now, queue the real create.
      const clientId = `local_x_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const draft: PickerExercise = {
        id: clientId,
        name,
        equipment: newEquipment,
        muscle: newMuscle,
        isTimed: false,
      };
      outbox.createExercise(clientId, {
        name,
        equipment: newEquipment,
        muscle: newMuscle,
      });
      toast.success(`Added "${name}" — will sync when you're online`);
      pick(clientId, draft);
      return;
    }

    startTransition(async () => {
      const res = await createCustomExercise({
        name,
        equipment: newEquipment as never,
        muscle: newMuscle,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added "${res.exercise.name}"`);
      pick(res.exercise.id, res.exercise);
    });
  }

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      {lockMuscle && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{lockMuscle}</Badge>
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
          autoFocus={!isMobile}
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
          {!query.trim() && recent.length > 0 && (
            <div className="mb-2">
              <p className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
                Recent
              </p>
              {recent.map((e) => (
                <ExerciseRow
                  key={`recent-${e.id}`}
                  e={e}
                  lastDone={lastDone(e.id)}
                  onPick={() => pick(e.id, e)}
                />
              ))}
            </div>
          )}
          {filtered.map(([muscle, items]) => (
            <div key={muscle} className="mb-2">
              <p className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
                {muscle}
              </p>
              {items.map((e) => (
                <ExerciseRow
                  key={e.id}
                  e={e}
                  lastDone={lastDone(e.id)}
                  onPick={() => pick(e.id, e)}
                />
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
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        {open ? (
          <SheetContent
            side="bottom"
            className="flex max-h-[88dvh] flex-col gap-3 rounded-t-2xl p-4"
          >
            {body}
          </SheetContent>
        ) : null}
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open ? (
        <DialogContent className="flex max-h-[80dvh] flex-col gap-3 overflow-hidden sm:max-w-md">
          {body}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ExerciseRow({
  e,
  lastDone,
  onPick,
}: {
  e: PickerExercise;
  lastDone: string | null;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="hover:bg-accent flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm"
    >
      <span className="min-w-0">
        <span className="block truncate">{e.name}</span>
        {lastDone ? (
          <span className="text-muted-foreground text-xs">
            done {formatDate(lastDone, { month: "short", day: "numeric" })}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
        <span>{EQUIPMENT_LABELS[e.equipment]}</span>
      </span>
    </button>
  );
}
