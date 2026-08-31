"use client";

import * as React from "react";

import { formatWeight, type WeightUnit } from "@/lib/training";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** True on phone-width screens. Starts false (SSR-safe), settles after mount. */
function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

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

/**
 * A number field that becomes a native scroll picker on phones (no keyboard,
 * no mid-type keyboard dismissal) and stays a text input on desktop.
 */
export function WheelField({
  kind,
  value,
  unit,
  placeholder,
  onInput,
  onPick,
  onBlur,
}: {
  kind: "weight" | "reps";
  value: number;
  unit: WeightUnit;
  placeholder?: string;
  /** every keystroke on desktop — caller debounces */
  onInput: (value: number) => void;
  /** a single committed value from the mobile picker */
  onPick: (value: number) => void;
  /** desktop blur — caller flushes whatever was typed */
  onBlur: () => void;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const base = kind === "weight" ? weightOptions(unit) : REPS_OPTIONS;
    const options = base.includes(value) ? base : [...base, value].sort((a, b) => a - b);
    return (
      <select
        value={String(value)}
        aria-label={kind === "weight" ? `Weight (${unit.toLowerCase()})` : "Reps"}
        onChange={(e) => onPick(Number(e.target.value))}
        className={cn(
          "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        )}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {kind === "weight" ? formatWeight(o, unit) : o}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type="number"
      inputMode={kind === "weight" ? "decimal" : "numeric"}
      step={kind === "weight" ? "0.5" : "1"}
      min="0"
      defaultValue={value || ""}
      placeholder={placeholder}
      onChange={(e) => onInput(Number(e.target.value) || 0)}
      onBlur={onBlur}
    />
  );
}
