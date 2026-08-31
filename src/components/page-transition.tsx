"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

// Tab order — a later tab is "forward" of an earlier one.
const TABS = [
  "/dashboard",
  "/dashboard/workouts",
  "/dashboard/progress",
  "/dashboard/templates",
  "/dashboard/exercises",
  "/dashboard/settings",
];

type Dir = "forward" | "back" | "none";

function direction(from: string, to: string): Dir {
  if (from === to) return "none";
  const fi = TABS.indexOf(from);
  const ti = TABS.indexOf(to);
  if (fi !== -1 && ti !== -1) return ti > fi ? "forward" : "back";
  if (to.startsWith(`${from}/`)) return "forward"; // opening a detail page
  if (from.startsWith(`${to}/`)) return "back"; // back up to the list
  return "forward";
}

/**
 * Slides page content in from the direction you navigated — right when moving
 * "forward" through the tabs or into a detail page, left when going back. Keyed
 * on the pathname so query-only changes (filters) don't re-trigger it.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prev, setPrev] = React.useState(pathname);
  const [dir, setDir] = React.useState<Dir>("none");

  // Adjust state during render (no effect, no paint in between) so the outgoing
  // `dir` is known on the very first frame of the new page.
  if (prev !== pathname) {
    setDir(direction(prev, pathname));
    setPrev(pathname);
  }

  return (
    <div key={pathname} data-dir={dir} className="page-transition">
      {children}
    </div>
  );
}
