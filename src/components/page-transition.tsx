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

// iOS-style deceleration — the page reads as having a bit of weight.
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SETTLE_MS = 300;
const PUSH_OFFSET = 20; // small nudge for taps / detail-page navigation

// One wrapper instance lives in the dashboard layout, so module-level state is
// enough to carry a hint from one page render to the next.
let lastPath = "";
// Set by a swipe release: the incoming page then slides in a full screen width
// (continuing the drag) instead of the small push nudge. 1 = forward, -1 = back.
let swipeEnter = 0;

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
 *  - on touch, drag the page left/right 1:1 with the finger and release (past a
 *    third of the width, or with a flick) to change tabs — carousel style.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);

  const swipeIndex = SWIPE_TABS.indexOf(pathname);
  const canSwipe = swipeIndex !== -1;

  // Enter animation. Layout effect so the offset is set before the browser paints.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dir = lastPath ? direction(lastPath, pathname) : "none";
    const fromSwipe = swipeEnter;
    swipeEnter = 0;
    lastPath = pathname;

    if (dir === "none" || prefersReducedMotion()) {
      el.style.transform = "";
      el.style.opacity = "";
      return;
    }

    const w = el.offsetWidth || window.innerWidth;
    const startX = fromSwipe
      ? fromSwipe * w
      : dir === "forward"
        ? PUSH_OFFSET
        : -PUSH_OFFSET;

    el.style.transition = "none";
    el.style.transform = `translate3d(${startX}px,0,0)`;
    el.style.opacity = fromSwipe ? "1" : "0"; // a swipe is a solid slide, no fade
    const raf = requestAnimationFrame(() => {
      el.style.transition = `transform ${SETTLE_MS}ms ${EASE}, opacity ${SETTLE_MS}ms ${EASE}`;
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
    let lastT = 0;
    let lastMX = 0;
    let vx = 0; // px per ms, smoothed

    const width = () => el.offsetWidth || window.innerWidth;
    const atStart = () => swipeIndex === 0;
    const atEnd = () => swipeIndex === SWIPE_TABS.length - 1;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < 24) return; // leave the browser's edge back-swipe alone
      if ((t.target as HTMLElement)?.closest?.(NO_SWIPE)) return;
      startX = lastMX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      active = true;
      horizontal = false;
      dx = 0;
      vx = 0;
      el.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;

      if (!horizontal) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (Math.abs(my) > Math.abs(mx)) {
          active = false; // vertical scroll — leave it alone
          return;
        }
        horizontal = true;
      }

      e.preventDefault(); // we own the gesture now; stop the page scrolling

      const now = e.timeStamp;
      const dt = now - lastT;
      if (dt > 0) vx = 0.7 * vx + 0.3 * ((t.clientX - lastMX) / dt);
      lastT = now;
      lastMX = t.clientX;

      const resist = (atStart() && mx > 0) || (atEnd() && mx < 0);
      dx = resist ? mx * 0.28 : mx; // rubber-band at the ends
      el.style.transform = `translate3d(${dx}px,0,0)`;
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (!horizontal) return;
      horizontal = false;

      const w = width();
      const passed = Math.abs(dx) > w * 0.32;
      const flicked = Math.abs(vx) > 0.35 && Math.sign(vx) === Math.sign(dx);
      const goNext = (passed || flicked) && dx < 0 && !atEnd();
      const goPrev = (passed || flicked) && dx > 0 && !atStart();
      const anim = reduced ? "none" : `transform ${SETTLE_MS}ms ${EASE}`;

      el.style.transition = anim;
      if (goNext || goPrev) {
        swipeEnter = goNext ? 1 : -1;
        el.style.transform = `translate3d(${goNext ? -w : w}px,0,0)`;
        router.push(SWIPE_TABS[swipeIndex + (goNext ? 1 : -1)]);
      } else {
        el.style.transform = "translate3d(0,0,0)";
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
