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
  localDateKey,
  type WeightUnit,
} from "@/lib/training";
import type { BodyData, BodyPoint } from "@/lib/queries/body";
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

const round1 = (n: number) => Math.round(n * 10) / 10;
const byDate = (a: BodyPoint, b: BodyPoint) => a.date.localeCompare(b.date);

export function BodyView({
  unit,
  heightCm: heightCmProp,
  birthday: birthdayProp,
  data,
}: {
  unit: WeightUnit;
  heightCm: number | null;
  birthday: string | null;
  data: BodyData;
}) {
  const router = useRouter();
  const u = unit.toLowerCase();

  // Local mirrors so logging / deleting / editing land instantly; a fresh server
  // copy (on error refresh, or a later visit) replaces them on the next render.
  const [points, setPoints] = React.useState(data.points);
  const [syncedPoints, setSyncedPoints] = React.useState(data.points);
  if (data.points !== syncedPoints) {
    setPoints(data.points);
    setSyncedPoints(data.points);
  }
  const [heightCm, setHeightCm] = React.useState(heightCmProp);
  const [birthday, setBirthday] = React.useState(birthdayProp);
  const [syncedProfile, setSyncedProfile] = React.useState({
    heightCmProp,
    birthdayProp,
  });
  if (
    syncedProfile.heightCmProp !== heightCmProp ||
    syncedProfile.birthdayProp !== birthdayProp
  ) {
    setHeightCm(heightCmProp);
    setBirthday(birthdayProp);
    setSyncedProfile({ heightCmProp, birthdayProp });
  }

  const [weight, setWeight] = React.useState("");

  const latest = points.at(-1) ?? null;
  const change =
    points.length > 1 && latest ? round1(latest.weight - points[0].weight) : null;

  const chartPoints = points.map((p) => ({
    ...p,
    label: formatDate(p.date, { month: "short", day: "numeric" }),
  }));

  function fail(e: unknown) {
    console.error(e);
    toast.error("Couldn't save that — reverting");
    router.refresh();
  }

  function submitWeight() {
    const value = Number(weight);
    if (!value || value <= 0) return;
    setWeight("");
    const tmpId = `tmp_${Date.now()}`;
    const optimistic: BodyPoint = {
      id: tmpId,
      date: localDateKey(new Date()),
      weight: round1(value),
      notes: null,
    };
    setPoints((p) => [...p, optimistic].sort(byDate));
    logWeight({ weight: value, unit })
      .then((entry) =>
        setPoints((p) => p.map((x) => (x.id === tmpId ? { ...x, id: entry.id } : x))),
      )
      .catch((e) => {
        setPoints((p) => p.filter((x) => x.id !== tmpId));
        fail(e);
      });
  }

  function removeEntry(id: string) {
    const snapshot = points;
    setPoints((p) => p.filter((x) => x.id !== id));
    deleteBodyEntry(id).catch((e) => {
      setPoints(snapshot);
      fail(e);
    });
  }

  function saveHeight(cm: number | null) {
    const prev = heightCm;
    setHeightCm(cm);
    updateBodyProfile({ heightCm: cm }).catch((e) => {
      setHeightCm(prev);
      fail(e);
    });
  }

  function saveBirthday(value: string | null) {
    const prev = birthday;
    setBirthday(value);
    updateBodyProfile({ birthday: value }).catch((e) => {
      setBirthday(prev);
      fail(e);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* current snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={`Weight (${u})`}
          value={latest ? String(latest.weight) : "—"}
          sub={latest ? `on ${formatDate(latest.date)}` : "not logged yet"}
        />
        <Stat
          label="Change"
          value={change == null ? "—" : `${change > 0 ? "+" : ""}${change} ${u}`}
          sub={change == null ? "needs 2+ entries" : "since your first entry"}
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
          <Button onClick={submitWeight} disabled={!weight}>
            Save
          </Button>
        </CardContent>
      </Card>

      {/* chart */}
      {chartPoints.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Body weight over time</CardTitle>
            <CardDescription>
              {chartPoints.length} entries, in {u}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-52 w-full sm:h-60">
              <LineChart data={chartPoints} margin={{ left: 4, right: 12, top: 4 }}>
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
                    aria-label="Delete entry"
                    onClick={() => removeEntry(p.id)}
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
          <HeightField cm={heightCm} unit={unit} onSave={saveHeight} />
          <div className="grid gap-1.5">
            <Label htmlFor="body-birthday">Birthday</Label>
            <Input
              id="body-birthday"
              type="date"
              defaultValue={birthday ? birthday.slice(0, 10) : ""}
              max={new Date().toISOString().slice(0, 10)}
              className="w-44"
              onChange={(e) => saveBirthday(e.target.value || null)}
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
  onSave,
}: {
  cm: number | null;
  unit: WeightUnit;
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
