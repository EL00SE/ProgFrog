"use client";

import * as React from "react";
import { ChevronDown, Dumbbell, Play, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { createWorkout, startWorkoutFromTemplateDay } from "@/lib/actions/workouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TemplateDay = { id: string; name: string; slots: number };
type Template = { id: string; name: string; days: TemplateDay[] };

export function StartWorkoutPicker({ templates }: { templates: Template[] }) {
  const [pending, startTransition] = React.useTransition();
  const [openId, setOpenId] = React.useState<string | null>(templates[0]?.id ?? null);
  const [name, setName] = React.useState("");
  // A fast double-tap can fire two starts before `pending` flips and disables
  // the button — creating two workouts, one of which lingers as a phantom.
  const starting = React.useRef(false);
  function guardStart(run: () => void) {
    if (starting.current || pending) return;
    starting.current = true;
    window.setTimeout(() => {
      starting.current = false;
    }, 2500);
    run();
  }

  function startFreestyle() {
    const fd = new FormData();
    if (name.trim()) fd.set("name", name.trim());
    guardStart(() => startTransition(() => createWorkout(fd)));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </span>
            Freestyle workout
          </CardTitle>
          <CardDescription>
            No plan today, or making up a missed day — start empty and add as you go.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="fs-name">Name (optional)</Label>
            <Input
              id="fs-name"
              value={name}
              maxLength={80}
              placeholder="Makeup — Push"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={startFreestyle} disabled={pending}>
            <Play className="size-4" /> Start freestyle
          </Button>
        </CardContent>
      </Card>

      {templates.length > 0 && (
        <>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            From a template
          </p>
          {templates.map((t) => {
            const open = openId === t.id;
            return (
              <Card key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : t.id)}
                  className="flex w-full items-center justify-between gap-2 px-(--card-spacing) text-left"
                >
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="text-muted-foreground size-4" />
                    {t.name}
                  </CardTitle>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground size-4 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open && (
                  <CardContent className="flex flex-col gap-2">
                    {t.days.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={pending || d.slots === 0}
                        onClick={() =>
                          guardStart(() =>
                            startTransition(() => startWorkoutFromTemplateDay(d.id)),
                          )
                        }
                        className="hover:bg-accent flex items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium">{d.name}</span>
                        <Badge variant="secondary">
                          {d.slots} {d.slots === 1 ? "slot" : "slots"}
                        </Badge>
                      </button>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
