"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { type WeightUnit } from "@/lib/training";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function range(from: number, to: number, step: number) {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const weightOptions = (unit: WeightUnit) =>
  unit === "KG"
    ? [...range(0, 50, 0.5), ...range(52.5, 250, 2.5)]
    : [...range(0, 120, 1), ...range(125, 550, 5)];

const REPS_OPTIONS = range(0, 60, 1);

/** How much one tap of the −/+ steppers moves the value. */
function stepFor(kind: "weight" | "reps", unit: WeightUnit) {
  if (kind === "reps") return 1;
  return unit === "KG" ? 2.5 : 5;
}

/**
 * A number field with −/+ steppers on either side. Tapping the centre opens a
 * native scroll picker on phones (no keyboard, no mid-type keyboard dismissal)
 * and stays a text input on desktop. The steppers cover the common ±1 rep /
 * ±plate adjustment; the centre is for jumping to an arbitrary value.
 */
export function WheelField({
  kind,
  value,
  unit,
  placeholder,
  disabled,
  onInput,
  onPick,
  onBlur,
}: {
  kind: "weight" | "reps";
  value: number;
  unit: WeightUnit;
  placeholder?: string;
  disabled?: boolean;
  /** every keystroke on desktop — caller debounces */
  onInput: (value: number) => void;
  /** a single committed value (mobile picker, or a stepper tap) */
  onPick: (value: number) => void;
  /** desktop blur — caller flushes whatever was typed */
  onBlur: () => void;
}) {
  const isMobile = useIsMobile();
  const step = stepFor(kind, unit);

  const nudge = (dir: -1 | 1) => {
    const next = Math.max(0, Math.round((value + dir * step) * 100) / 100);
    if (next !== value) onPick(next);
  };

  const stepperClass = cn(
    "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
    "flex h-11 w-7 shrink-0 items-center justify-center rounded-md border",
    "disabled:pointer-events-none disabled:opacity-40",
  );

  return (
    <div className="flex items-stretch gap-1">
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || value <= 0}
        onClick={() => nudge(-1)}
        aria-label="Decrease"
        className={stepperClass}
      >
        <Minus className="size-4" />
      </button>
      {isMobile ? (
        (() => {
          const base = kind === "weight" ? weightOptions(unit) : REPS_OPTIONS;
          const options = base.includes(value)
            ? base
            : [...base, value].sort((a, b) => a - b);
          return (
            <select
              value={String(value)}
              disabled={disabled}
              aria-label={kind === "weight" ? `Weight (${unit.toLowerCase()})` : "Reps"}
              onChange={(e) => onPick(Number(e.target.value))}
              className={cn(
                "border-input dark:bg-input/30 h-11 min-w-0 flex-1 appearance-none rounded-md border bg-transparent px-1 text-center text-base tabular-nums outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:opacity-50",
              )}
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          );
        })()
      ) : (
        <Input
          type="number"
          inputMode={kind === "weight" ? "decimal" : "numeric"}
          step={kind === "weight" ? "0.5" : "1"}
          min="0"
          disabled={disabled}
          defaultValue={value || ""}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 text-center tabular-nums"
          onChange={(e) => onInput(Number(e.target.value) || 0)}
          onBlur={onBlur}
        />
      )}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => nudge(1)}
        aria-label="Increase"
        className={stepperClass}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
