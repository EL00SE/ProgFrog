"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TemplateOption = { id: string; name: string; days: { id: string; name: string }[] };
const NEW_DAY = "__new__";

export function AddToTemplateDialog({
  workoutId,
  templates,
}: {
  workoutId: string;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");
  const [dayId, setDayId] = React.useState(NEW_DAY);
  const [mode, setMode] = React.useState<"exercise" | "slot">("exercise");

  const template = templates.find((t) => t.id === templateId);

  function pickTemplate(id: string) {
    setTemplateId(id);
    setDayId(NEW_DAY);
  }

  function submit() {
    startTransition(async () => {
      try {
        const res = await addWorkoutToTemplate({
          workoutId,
          templateId,
          dayId: dayId === NEW_DAY ? null : dayId,
          mode,
        });
        setOpen(false);
        toast.success("Added to the template", {
          action: {
            label: "Open",
            onClick: () => router.push(`/dashboard/templates/${res.templateId}`),
          },
        });
      } catch {
        toast.error("Couldn't add it — try again");
      }
    });
  }

  if (templates.length === 0) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/templates">
          <ListChecks className="size-4" /> Make a template
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListChecks className="size-4" /> Add to template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to a template</DialogTitle>
          <DialogDescription>
            Copies this session&rsquo;s exercises, sets and rep targets onto a template
            day.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={pickTemplate}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="grid gap-1.5">
            <Label>Import each exercise as</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "exercise" | "slot")}
              className="gap-2"
            >
              <Label
                htmlFor="mode-exercise"
                className="has-data-checked:border-primary flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm font-normal"
              >
                <RadioGroupItem id="mode-exercise" value="exercise" className="mt-0.5" />
                <span>
                  <span className="font-medium">The exact exercise</span>
                  <span className="text-muted-foreground block text-xs">
                    e.g. &ldquo;Dumbbell Bench Press&rdquo;, pencilled in
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="mode-slot"
                className="has-data-checked:border-primary flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm font-normal"
              >
                <RadioGroupItem id="mode-slot" value="slot" className="mt-0.5" />
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
          <Button onClick={submit} disabled={pending || !templateId}>
            {pending ? "Adding…" : "Add to template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
