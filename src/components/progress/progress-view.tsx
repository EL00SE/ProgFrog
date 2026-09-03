"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { formatDate, formatWeight } from "@/lib/training";
import type { ProgressSeries } from "@/lib/queries/progress";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProgressOption = { value: string; label: string };
export type ProgressLens = "exercise" | "muscle";

const chartConfig = {
  best1RM: { label: "Est. 1-rep max", color: "var(--chart-1)" },
  topSetWeight: { label: "Heaviest set", color: "var(--chart-2)" },
  volume: { label: "Weight lifted", color: "var(--chart-3)" },
} satisfies ChartConfig;

/**
 * Presentational — the Progress pane wrapper owns the state, data fetching and
 * URL sync (it can't lean on the route re-rendering inside the tab pager).
 */
export function ProgressView({
  view,
  hasMuscles,
  hasExercises,
  options,
  selectedKey,
  series,
  loading = false,
  chartsReady = true,
  onView,
  onSelect,
}: {
  view: ProgressLens;
  hasMuscles: boolean;
  hasExercises: boolean;
  options: ProgressOption[];
  selectedKey: string | null;
  series: ProgressSeries | null;
  loading?: boolean;
  chartsReady?: boolean;
  onView: (v: ProgressLens) => void;
  onSelect: (value: string) => void;
}) {
  const unit = series?.unit ?? "KG";
  const data =
    series?.points.map((p) => ({
      ...p,
      label: formatDate(p.date, { month: "short", day: "numeric" }),
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {hasMuscles && hasExercises && (
        <div className="bg-muted/60 inline-flex w-fit gap-1 rounded-lg p-1">
          {(
            [
              ["exercise", "By exercise"],
              ["muscle", "By muscle"],
            ] as const
          ).map(([v, label]) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "default" : "ghost"}
              onClick={() => onView(v)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      <Select value={selectedKey ?? undefined} onValueChange={onSelect}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue
            placeholder={
              view === "muscle" ? "Choose a muscle group" : "Choose an exercise"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {series && data.length > 0 ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label="Est. 1-rep max"
              value={formatWeight(series.prs.best1RM, unit)}
              sub={
                series.prs.best1RMDate ? formatDate(series.prs.best1RMDate) : undefined
              }
            />
            <Stat label="Heaviest set" value={formatWeight(series.prs.maxWeight, unit)} />
            <Stat
              label="Best workout"
              value={formatWeight(series.prs.bestVolume, unit)}
            />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{series.title}</CardTitle>
              <CardDescription>
                {view === "muscle"
                  ? "Every set logged for this muscle group, over "
                  : "Estimated 1-rep max and heaviest-set weight over "}
                {data.length} {data.length === 1 ? "workout" : "workouts"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartsReady ? (
                <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
                  <LineChart data={data} margin={{ left: 4, right: 12, top: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex w-full justify-between gap-3">
                              <span className="text-muted-foreground">
                                {chartConfig[name as keyof typeof chartConfig]?.label ??
                                  name}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {formatWeight(Number(value), unit)}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      name="best1RM"
                      dataKey="best1RM"
                      stroke="var(--color-best1RM)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      name="topSetWeight"
                      dataKey="topSetWeight"
                      stroke="var(--color-topSetWeight)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="bg-muted/40 h-56 w-full animate-pulse rounded-md sm:h-64" />
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Total weight lifted</CardTitle>
              <CardDescription>
                Weight × reps added up across the workout (warm-ups excluded)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartsReady ? (
                <ChartContainer config={chartConfig} className="h-48 w-full sm:h-56">
                  <LineChart data={data} margin={{ left: 4, right: 12, top: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-medium tabular-nums">
                              {formatWeight(Number(value), unit)}
                            </span>
                          )}
                        />
                      }
                    />
                    <Line
                      dataKey="volume"
                      stroke="var(--color-volume)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="bg-muted/40 h-48 w-full animate-pulse rounded-md sm:h-56" />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {loading ? "Loading…" : "No logged sets here yet."}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5 py-1">
        <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
          {label}
        </span>
        <span className="font-heading text-primary text-base font-semibold tabular-nums sm:text-xl">
          {value}
        </span>
        {sub ? <span className="text-muted-foreground text-xs">{sub}</span> : null}
      </CardContent>
    </Card>
  );
}
