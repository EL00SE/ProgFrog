"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateWeightUnit } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function WeightUnitForm({ current }: { current: "KG" | "LB" }) {
  const router = useRouter();
  const [value, setValue] = React.useState<"KG" | "LB">(current);
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={value}
        onValueChange={(v) => setValue(v as "KG" | "LB")}
        className="grid-cols-2"
      >
        {(
          [
            ["KG", "Kilograms"],
            ["LB", "Pounds"],
          ] as const
        ).map(([v, label]) => (
          <Label
            key={v}
            htmlFor={`unit-${v}`}
            className="has-data-checked:border-primary flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-normal"
          >
            <RadioGroupItem id={`unit-${v}`} value={v} />
            {label}
          </Label>
        ))}
      </RadioGroup>

      <Button
        className="w-fit"
        disabled={pending || value === current}
        onClick={() =>
          startTransition(async () => {
            await updateWeightUnit({ weightUnit: value });
            toast.success(`Weight unit set to ${value.toLowerCase()}`);
            router.refresh();
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
