"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import {
  ageFromBirthday,
  cmToFeetInches,
  feetInchesToCm,
  formatDate,
  formatHeight,
  type WeightUnit,
} from "@/lib/training";
import type { BodyData } from "@/lib/queries/body";
import { deleteBodyEntry, logWeight, updateBodyProfile } from "@/lib/actions/body";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const chartConfig = {
  weight: { label: "Body weight", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function BodyView({
  unit,
  heightCm,
  birthday,
  data,
}: {
  unit: WeightUnit;
  heightCm: number | null;
  birthday: string | null;
  data: BodyData;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const u = unit.toLowerCase();

  const points = data.points.map((p) => ({
    ...p,
    label: formatDate(p.date, { month: "short", day: "numeric" }),
  }));

  const [weight, setWeight] = React.useState("");

  function save(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        toast.error("Couldn't save that");
      }
    });
  }

  function submitWeight() {
    const value = Number(weight);
    if (!value || value <= 0) return;
    setWeight("");
    save(() => logWeight({ weight: value, unit }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* current snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={`Weight (${u})`}
          value={data.latest ? String(data.latest.weight) : "—"}
          sub={data.latest ? `on ${formatDate(data.latest.date)}` : "not logged yet"}
        />
        <Stat
          label="Change"
          value={
            data.change == null ? "—" : `${data.change > 0 ? "+" : ""}${data.change} ${u}`
          }
          sub={data.change == null ? "needs 2+ entries" : "since your first entry"}
        />
        <Stat label="Height" value={formatHeight(heightCm, unit)} sub="edit below" />
        <Stat
          label="Age"
          value={ageFromBirthday(birthday)?.toString() ?? "—"}
          sub={birthday ? "from your birthday" : "add birthday below"}
        />
      </div>

      {/* log weight */}
      <Card>
        <CardHeader>
          <CardTitle>Log today&rsquo;s weight</CardTitle>
          <CardDescription>Weigh in regularly to see the trend.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="body-weight">Weight ({u})</Label>
            <Input
              id="body-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitWeight()}
              className="w-28"
            />
          </div>
          <Button onClick={submitWeight} disabled={pending || !weight}>
            Save
          </Button>
        </CardContent>
      </Card>

      {/* chart */}
      {points.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Body weight over time</CardTitle>
            <CardDescription>
              {points.length} entries, in {u}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-52 w-full sm:h-60">
              <LineChart data={points} margin={{ left: 4, right: 12, top: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <YAxis
                  width={38}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 1", "dataMax + 1"]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="weight"
                  type="monotone"
                  stroke="var(--color-weight)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* history */}
      {points.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {[...points].reverse().map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 tabular-nums"
              >
                <span className="text-muted-foreground">
                  {formatDate(p.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">
                    {p.weight} {u}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={pending}
                    aria-label="Delete entry"
                    onClick={() => save(() => deleteBodyEntry(p.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* profile */}
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            Height and birthday — set these once. Age updates itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <HeightField
            cm={heightCm}
            unit={unit}
            disabled={pending}
            onSave={(cm) => save(() => updateBodyProfile({ heightCm: cm }))}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="body-birthday">Birthday</Label>
            <Input
              id="body-birthday"
              type="date"
              defaultValue={birthday ? birthday.slice(0, 10) : ""}
              max={new Date().toISOString().slice(0, 10)}
              disabled={pending}
              className="w-44"
              onChange={(e) =>
                save(() => updateBodyProfile({ birthday: e.target.value || null }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeightField({
  cm,
  unit,
  disabled,
  onSave,
}: {
  cm: number | null;
  unit: WeightUnit;
  disabled: boolean;
  onSave: (cm: number | null) => void;
}) {
  const imperial = cm ? cmToFeetInches(cm) : { ft: 0, in: 0 };
  const [ft, setFt] = React.useState(cm ? String(imperial.ft) : "");
  const [inches, setInches] = React.useState(cm ? String(imperial.in) : "");

  if (unit === "KG") {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor="body-height-cm">Height (cm)</Label>
        <Input
          id="body-height-cm"
          type="number"
          inputMode="numeric"
          min="50"
          max="280"
          defaultValue={cm ? Math.round(cm) : ""}
          disabled={disabled}
          className="w-28"
          onBlur={(e) => {
            const v = Number(e.target.value);
            onSave(v >= 50 && v <= 280 ? v : null);
          }}
        />
      </div>
    );
  }

  const commit = () => {
    const f = Number(ft);
    const i = Number(inches);
    onSave(f || i ? feetInchesToCm(f || 0, i || 0) : null);
  };
  return (
    <div className="grid gap-1.5">
      <Label>Height</Label>
      <div className="flex items-center gap-1">
        <Input
          aria-label="Feet"
          type="number"
          min="3"
          max="8"
          value={ft}
          disabled={disabled}
          className="w-16"
          onChange={(e) => setFt(e.target.value)}
          onBlur={commit}
        />
        <span className="text-muted-foreground text-sm">ft</span>
        <Input
          aria-label="Inches"
          type="number"
          min="0"
          max="11"
          value={inches}
          disabled={disabled}
          className="w-16"
          onChange={(e) => setInches(e.target.value)}
          onBlur={commit}
        />
        <span className="text-muted-foreground text-sm">in</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-0.5 rounded-xl border p-3">
      <span className="font-heading text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[0.7rem] tracking-wide uppercase">
        {label}
      </span>
      {sub ? <span className="text-muted-foreground text-[0.7rem]">{sub}</span> : null}
    </div>
  );
}
