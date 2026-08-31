"use client";

import * as React from "react";

import { MUSCLE_GROUPS, ROLE_LABELS, ROLE_VALUES } from "@/lib/training";
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

/** Pick a muscle + role to add an open (exercise-less) slot. */
export function AddSlotDialog({
  trigger,
  onAdd,
}: {
  trigger: React.ReactNode;
  onAdd: (slot: { muscle: string; role: string }) => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [muscle, setMuscle] = React.useState("Chest");
  const [role, setRole] = React.useState("MAIN");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    try {
      await onAdd({ muscle, role });
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
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Muscle</Label>
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
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
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
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Add slot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
