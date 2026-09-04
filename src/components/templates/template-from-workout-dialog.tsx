"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/training";
import { addWorkoutToTemplate } from "@/lib/actions/templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PastWorkout = {
  id: string;
  name: string | null;
  number: number | null;
  date: string;
  exerciseNames: string[];
};
type TemplateOption = { id: string; name: string; days: { id: string; name: string }[] };

const NEW_TEMPLATE = "__new_template__";
const NEW_DAY = "__new_day__";

function workoutLabel(w: PastWorkout): string {
  const base = w.name?.trim() || "Workout";
  const num = w.number ? `#${w.number} · ` : "";
  return `${num}${base} · ${formatDate(w.date, { month: "short", day: "numeric" })}`;
}

/**
 * Templates-tab entry point for "build a template from a session I already
 * logged" — the same move the finished-workout view offers, but here you also
 * pick which workout and can spin up a brand-new template in one step.
 */
export function TemplateFromWorkoutDialog({
  workouts,
  templates,
}: {
  workouts: PastWorkout[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [workoutId, setWorkoutId] = React.useState(workouts[0]?.id ?? "");
  const [dest, setDest] = React.useState<string>(NEW_TEMPLATE);
  const [dayId, setDayId] = React.useState(NEW_DAY);
  const [name, setName] = React.useState(workouts[0]?.name?.trim() ?? "");
  const [mode, setMode] = React.useState<"exercise" | "slot">("exercise");
  // Once the user edits the name, stop auto-filling it from the workout.
  const nameTouched = React.useRef(false);

  const workout = workouts.find((w) => w.id === workoutId);
  const template = templates.find((t) => t.id === dest);
  const creatingTemplate = dest === NEW_TEMPLATE;

  function pickWorkout(id: string) {
    setWorkoutId(id);
    if (!nameTouched.current) {
      setName(workouts.find((w) => w.id === id)?.name?.trim() ?? "");
    }
  }

  function pickDest(v: string) {
    setDest(v);
    setDayId(NEW_DAY);
  }

  function submit() {
    if (!workoutId) return;
    if (creatingTemplate && !name.trim()) {
      toast.error("Name the new template first");
      return;
    }
    startTransition(async () => {
      try {
        const res = await addWorkoutToTemplate({
          workoutId,
          templateId: creatingTemplate ? null : dest,
          newTemplateName: creatingTemplate ? name.trim() : undefined,
          dayId: creatingTemplate || dayId === NEW_DAY ? null : dayId,
          mode,
        });
        setOpen(false);
        toast.success(creatingTemplate ? "Template created" : "Template updated");
        // Land in the editor — the always-mounted Templates pane won't reflect
        // the change until a navigation anyway.
        router.push(`/dashboard/templates/${res.templateId}`);
      } catch {
        toast.error("Couldn't build it — try again");
      }
    });
  }

  if (workouts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="size-4" /> New from a past workout
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] max-w-sm flex-col gap-3 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template from a past workout</DialogTitle>
          <DialogDescription>
            Copies that session&rsquo;s exercises, set counts and rep targets onto a
            template day.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Workout</Label>
            <Select value={workoutId} onValueChange={pickWorkout}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workouts.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {workoutLabel(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workout && workout.exerciseNames.length > 0 ? (
              <p className="text-muted-foreground truncate text-xs">
                {workout.exerciseNames.join(", ")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label>Add to</Label>
            <Select value={dest} onValueChange={pickDest}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_TEMPLATE}>New template…</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {creatingTemplate ? (
            <div className="grid gap-1.5">
              <Label htmlFor="tfw-name">Template name</Label>
              <Input
                id="tfw-name"
                value={name}
                maxLength={80}
                placeholder="Push / Pull / Legs"
                onChange={(e) => {
                  nameTouched.current = true;
                  setName(e.target.value);
                }}
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label>Day</Label>
              <Select value={dayId} onValueChange={setDayId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_DAY}>New day</SelectItem>
                  {template?.days.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Import each exercise as</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "exercise" | "slot")}
              className="gap-2"
            >
              <Label
                htmlFor="tfw-exercise"
                className="has-data-checked:border-primary flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm font-normal"
              >
                <RadioGroupItem id="tfw-exercise" value="exercise" className="mt-0.5" />
                <span>
                  <span className="font-medium">The exact exercise</span>
                  <span className="text-muted-foreground block text-xs">
                    e.g. &ldquo;Dumbbell Bench Press&rdquo;, pencilled in
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="tfw-slot"
                className="has-data-checked:border-primary flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm font-normal"
              >
                <RadioGroupItem id="tfw-slot" value="slot" className="mt-0.5" />
                <span>
                  <span className="font-medium">An open slot</span>
                  <span className="text-muted-foreground block text-xs">
                    just the muscle group — pick the exercise each session
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || !workoutId}>
            {pending ? "Building…" : "Build template day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
