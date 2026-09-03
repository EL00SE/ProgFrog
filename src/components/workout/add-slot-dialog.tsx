"use client";

import * as React from "react";

import { MUSCLE_GROUPS } from "@/lib/training";
import { Button } from "@/components/ui/button";
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

/** Pick a muscle group to add an open (exercise-less) slot. */
export function AddSlotDialog({
  trigger,
  onAdd,
}: {
  trigger: React.ReactNode;
  onAdd: (slot: { muscle: string }) => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [muscle, setMuscle] = React.useState("Chest");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    try {
      await onAdd({ muscle });
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a slot</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Add slot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
