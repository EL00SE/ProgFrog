"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

// Tab order — a later tab is "forward" of an earlier one.
const TABS = [
  "/dashboard",
  "/dashboard/workouts",
  "/dashboard/progress",
  "/dashboard/templates",
  "/dashboard/exercises",
  "/dashboard/settings",
];

// The four tabs you can swipe between on mobile (Dashboard and Settings are the
// ends and only reachable by tap).
const SWIPE_TABS = TABS.slice(1, 5);

const NO_SWIPE =
  "input,textarea,select,button,a,[role=slider],[data-slot=select-trigger]," +
  "[data-noswipe],.recharts-wrapper,.overflow-x-auto,[data-scroll-x]";

const ENTER_MS = 220;
const SETTLE = `transform ${ENTER_MS}ms ease-out, opacity ${ENTER_MS}ms ease-out`;
const OFFSET = 24;

// One wrapper instance lives in the dashboard layout, so a module-level "last
// path" is enough to tell which way the next navigation is going.
let lastPath = "";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function direction(from: string, to: string): "forward" | "back" | "none" {
  if (from === to) return "none";
  const fi = TABS.indexOf(from);
  const ti = TABS.indexOf(to);
  if (fi !== -1 && ti !== -1) return ti > fi ? "forward" : "back";
  if (to.startsWith(`${from}/`)) return "forward"; // opening a detail page
  if (from.startsWith(`${to}/`)) return "back"; // back up to the list
  return "forward";
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The page content wrapper. Two jobs:
 *  - slides new content in from the direction you navigated,
 *  - on touch, drag the current page left/right and release to change tabs,
 *    carousel-style. Keyed on the pathname so filters don't re-trigger it.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);

  const swipeIndex = SWIPE_TABS.indexOf(pathname);
  const canSwipe = swipeIndex !== -1;

  // Enter animation — start offset in the travel direction, then ease home.
  // Layout effect so the offset is set before the browser paints.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dir = lastPath ? direction(lastPath, pathname) : "none";
    lastPath = pathname;
    if (dir === "none" || prefersReducedMotion()) return;

    el.style.transition = "none";
    el.style.transform = `translate3d(${dir === "forward" ? OFFSET : -OFFSET}px,0,0)`;
    el.style.opacity = "0";
    const raf = requestAnimationFrame(() => {
      el.style.transition = SETTLE;
      el.style.transform = "translate3d(0,0,0)";
      el.style.opacity = "1";
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  // Warm the swipe neighbours so releasing the gesture lands instantly.
  React.useEffect(() => {
    if (swipeIndex === -1) return;
    if (swipeIndex > 0) router.prefetch(SWIPE_TABS[swipeIndex - 1]);
    if (swipeIndex < SWIPE_TABS.length - 1) router.prefetch(SWIPE_TABS[swipeIndex + 1]);
  }, [swipeIndex, router]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !canSwipe) return;
    const reduced = prefersReducedMotion();

    let startX = 0;
    let startY = 0;
    let active = false;
    let horizontal = false;
    let dx = 0;

    const width = () => el.offsetWidth || window.innerWidth;

    const settle = (transform: string, opacity: string) => {
      el.style.transition = reduced ? "none" : SETTLE;
      void el.offsetWidth; // commit the dragged transform as the animation start
      el.style.transform = transform;
      el.style.opacity = opacity;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < 24) return; // leave the browser's edge back-swipe alone
      if ((t.target as HTMLElement)?.closest?.(NO_SWIPE)) return;
      startX = t.clientX;
      startY = t.clientY;
      active = true;
      horizontal = false;
      dx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;

      if (!horizontal) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        if (Math.abs(my) >= Math.abs(mx)) {
          active = false; // vertical scroll — leave it alone
          return;
        }
        horizontal = true;
        el.style.transition = "none";
      }

      e.preventDefault(); // we own the gesture now; stop the page scrolling
      const nearStart = swipeIndex === 0 && mx > 0;
      const nearEnd = swipeIndex === SWIPE_TABS.length - 1 && mx < 0;
      dx = nearStart || nearEnd ? mx * 0.25 : mx; // rubber-band at the ends
      el.style.transform = `translate3d(${dx}px,0,0)`;
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / width(), 1) * 0.3);
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (!horizontal) return;
      horizontal = false;

      const threshold = Math.min(width() * 0.28, 90);
      const goNext = dx <= -threshold && swipeIndex < SWIPE_TABS.length - 1;
      const goPrev = dx >= threshold && swipeIndex > 0;

      if (goNext || goPrev) {
        settle(`translate3d(${goNext ? -width() : width()}px,0,0)`, "0");
        router.push(SWIPE_TABS[swipeIndex + (goNext ? 1 : -1)]);
      } else {
        settle("translate3d(0,0,0)", "1");
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [canSwipe, swipeIndex, router]);

  return (
    <div key={pathname} ref={ref} className="min-h-full will-change-transform">
      {children}
    </div>
  );
}
