"use client";

import * as React from "react";

import type { WeightUnit } from "@/lib/training";
import type { BodyData } from "@/lib/queries/body";
import type { ProgressSeries } from "@/lib/queries/progress";
import { getProgressSeries } from "@/lib/actions/progress";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { BodyView } from "@/components/progress/body-view";
import {
  type ProgressLens,
  type ProgressOption,
  ProgressView,
} from "@/components/progress/progress-view";
import { usePaneVisited } from "@/components/dashboard/tab-pager";

type Section = "lifts" | "body";

/** Progress is index 2 in the tab strip — gate the charts on it having been shown. */
const PROGRESS_PANE_INDEX = 2;

export function ProgressPaneClient({
  unit,
  heightCm,
  birthday,
  bodyData,
  exerciseOptions,
  muscleOptions,
  initialView,
  initialKey,
  initialSeries,
}: {
  unit: WeightUnit;
  heightCm: number | null;
  birthday: string | null;
  bodyData: BodyData;
  exerciseOptions: ProgressOption[];
  muscleOptions: ProgressOption[];
  initialView: ProgressLens;
  initialKey: string | null;
  initialSeries: ProgressSeries | null;
}) {
  const [section, setSection] = React.useState<Section>("lifts");
  const [view, setView] = React.useState<ProgressLens>(initialView);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(initialKey);
  const [series, setSeries] = React.useState<ProgressSeries | null>(initialSeries);
  const [loading, startLoad] = React.useTransition();

  const chartsReady = usePaneVisited(PROGRESS_PANE_INDEX);
  const optionsFor = (v: ProgressLens) =>
    v === "muscle" ? muscleOptions : exerciseOptions;

  // Re-seed from the URL once on mount — post-hydration so it can't mismatch the
  // server render (the layout can't read searchParams to pass them down).
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("section") === "body") setSection("body");
    const v: ProgressLens = sp.get("view") === "muscle" ? "muscle" : "exercise";
    const k = sp.get(v);
    if (v !== initialView || (k && k !== initialKey)) {
      const key = k ?? optionsFor(v)[0]?.value ?? null;
      setView(v);
      setSelectedKey(key);
      if (key) load(v, key);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function syncUrl(next: {
    section?: Section;
    view?: ProgressLens;
    key?: string | null;
  }) {
    const s = next.section ?? section;
    const v = next.view ?? view;
    const k = next.key === undefined ? selectedKey : next.key;
    const params = new URLSearchParams();
    if (s === "body") params.set("section", "body");
    if (s === "lifts") {
      if (v === "muscle") params.set("view", "muscle");
      if (k) params.set(v, k);
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `/dashboard/progress?${qs}` : "/dashboard/progress",
    );
  }

  function load(kind: ProgressLens, key: string) {
    startLoad(async () => {
      setSeries(await getProgressSeries(kind, key));
    });
  }

  function onSection(s: Section) {
    setSection(s);
    syncUrl({ section: s });
  }

  function onView(v: ProgressLens) {
    if (v === view) return;
    const key = optionsFor(v)[0]?.value ?? null;
    setView(v);
    setSelectedKey(key);
    syncUrl({ view: v, key });
    if (key) load(v, key);
    else setSeries(null);
  }

  function onSelect(key: string) {
    setSelectedKey(key);
    syncUrl({ key });
    load(view, key);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Progress"
        description={
          section === "body"
            ? "Track your body weight over time, next to your lifts."
            : `How your strength is trending — estimated 1-rep max, heaviest set, and total weight lifted per workout, in ${unit.toLowerCase()}.`
        }
      />

      <div className="bg-muted/60 inline-flex w-fit gap-1 rounded-lg p-1 text-sm font-medium">
        {(
          [
            ["lifts", "Lifts"],
            ["body", "Body"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onSection(v)}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              section === v
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "body" ? (
        <BodyView unit={unit} heightCm={heightCm} birthday={birthday} data={bodyData} />
      ) : exerciseOptions.length === 0 && muscleOptions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Log a few workouts and your trends will appear here.
        </p>
      ) : (
        <ProgressView
          view={view}
          hasExercises={exerciseOptions.length > 0}
          hasMuscles={muscleOptions.length > 0}
          options={optionsFor(view)}
          selectedKey={selectedKey}
          series={series}
          loading={loading}
          chartsReady={chartsReady}
          onView={onView}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
