"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

/** Tab pages you can swipe between, in order. */
const PAGES = [
  "/dashboard/workouts",
  "/dashboard/progress",
  "/dashboard/templates",
  "/dashboard/exercises",
];

const IGNORE =
  "input,textarea,select,button,a,[data-slot=select-trigger],[data-noswipe],.recharts-wrapper";

/**
 * Horizontal swipe between the mobile tab pages. Desktop and detail pages are
 * unaffected. Leaves the browser's edge back-swipe alone.
 */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const start = React.useRef<{ x: number; y: number; ok: boolean } | null>(null);

  const index = PAGES.indexOf(pathname);

  React.useEffect(() => {
    // Prefetch neighbours so the swipe navigation feels instant.
    if (index === -1) return;
    if (index > 0) router.prefetch(PAGES[index - 1]);
    if (index < PAGES.length - 1) router.prefetch(PAGES[index + 1]);
  }, [index, router]);

  function onTouchStart(e: React.TouchEvent) {
    if (index === -1 || e.touches.length !== 1) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    const ok = t.clientX > 24 && !target.closest(IGNORE);
    start.current = { x: t.clientX, y: t.clientY, ok };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current;
    start.current = null;
    if (!s || !s.ok) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;

    const next = dx < 0 ? index + 1 : index - 1;
    if (next >= 0 && next < PAGES.length) router.push(PAGES[next]);
  }

  return (
    <div className="contents" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
}
