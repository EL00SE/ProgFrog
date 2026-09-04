"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

const SETTLE_MS = 300;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const PUSH_OFFSET = 16;

// Only block a drag from things that genuinely own the horizontal axis — text
// fields, sliders, the Select trigger, and anything that scrolls sideways.
// Links, buttons, cards and charts stay swipeable (a chart tooltip is tap-
// triggered, not drag-triggered), so almost the whole pane can start a swipe.
const NO_SWIPE =
  "input,textarea,[role=slider],[role=combobox],[data-slot=select-trigger]," +
  "[data-noswipe],.overflow-x-auto,[data-scroll-x]";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type PagerCtx = { activeIndex: number; visited: readonly boolean[] };
const PagerContext = React.createContext<PagerCtx>({ activeIndex: 0, visited: [] });

/** True once the pane at `index` has been the active one at least once. */
export function usePaneVisited(index: number): boolean {
  return React.useContext(PagerContext).visited[index] ?? false;
}

/**
 * The five bottom-nav tabs, kept mounted side-by-side. A swipe drags the strip
 * 1:1 and snaps to the neighbour with `history.pushState` — no navigation, no
 * re-render. Detail routes (`/workouts/[id]`, editors, settings) fall through to
 * `{children}` with a light enter slide.
 */
export function TabPager({
  tabs,
  titles,
  panes,
  children,
}: {
  tabs: string[];
  titles: string[];
  panes: React.ReactNode[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const pathIndex = tabs.indexOf(pathname);
  const isDetail = pathIndex === -1;

  const [index, setIndex] = React.useState(pathIndex === -1 ? 0 : pathIndex);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);
  const selfNav = React.useRef(false);

  // Which panes have been the active one (once true, stays true) — gates the
  // Progress charts so five panes mounting on load doesn't rasterise an
  // off-screen SVG. Conditional setState-during-render is the sanctioned way to
  // grow state from a value computed this render.
  const [visited, setVisited] = React.useState<boolean[]>(() =>
    tabs.map((_, i) => i === Math.max(0, pathIndex)),
  );
  if (!visited[index]) {
    setVisited(visited.map((seen, i) => seen || i === index));
  }

  // Keep the local index in step with the URL when it changes from outside the
  // pager (a tab tap, the back button, a deep link). A tab tap is a shallow
  // `history.pushState`, so Next never renders the route — set the title here.
  React.useEffect(() => {
    if (pathIndex === -1) return;
    if (selfNav.current) {
      selfNav.current = false;
      return;
    }
    setIndex(pathIndex);
    if (titles[pathIndex]) document.title = titles[pathIndex];
  }, [pathIndex, titles]);

  // Animate the strip to `index` (used for taps / back / the tail of a swipe).
  const positionStrip = React.useCallback(
    (animate: boolean) => {
      const el = stripRef.current;
      if (!el) return;
      el.style.transition =
        animate && !prefersReducedMotion() ? `transform ${SETTLE_MS}ms ${EASE}` : "none";
      el.style.transform = `translate3d(${-index * 100}%,0,0)`;
    },
    [index],
  );

  React.useEffect(() => {
    if (!isDetail) positionStrip(true);
  }, [index, isDetail, positionStrip]);

  // Touch drag — mobile, tab routes only.
  React.useEffect(() => {
    const el = stripRef.current;
    if (!el || isDetail || !isMobile) return;

    let startX = 0;
    let startY = 0;
    let active = false;
    let horizontal = false;
    let dx = 0;
    let w = 1;
    let lastT = 0;
    let lastX = 0;
    let vx = 0;
    let swiped = false;

    const drop = () => {
      el.style.willChange = "";
    };

    // Eat the emulated click that follows a drag, so swiping across a card /
    // link doesn't also open it.
    const onClickCapture = (e: MouseEvent) => {
      if (swiped) {
        e.preventDefault();
        e.stopPropagation();
        swiped = false;
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < 24) return;
      if ((t.target as HTMLElement)?.closest?.(NO_SWIPE)) return;
      w = el.offsetWidth || 1;
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      active = true;
      horizontal = false;
      swiped = false;
      dx = 0;
      vx = 0;
      el.style.willChange = "transform";
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;
      if (!horizontal) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        if (Math.abs(my) > Math.abs(mx)) {
          active = false;
          drop();
          return;
        }
        horizontal = true;
      }
      // Capture phase — take the gesture before a chart / card sees it, so a
      // swipe over a chart doesn't also drive its tooltip.
      e.preventDefault();
      e.stopPropagation();

      const now = e.timeStamp;
      const dt = now - lastT;
      if (dt > 0) vx = 0.7 * vx + 0.3 * ((t.clientX - lastX) / dt);
      lastT = now;
      lastX = t.clientX;

      const resist = (index === 0 && mx > 0) || (index === tabs.length - 1 && mx < 0);
      dx = resist ? mx * 0.28 : mx;
      el.style.transition = "none";
      el.style.transform = `translate3d(calc(${-index * 100}% + ${dx}px),0,0)`;
    };

    const onEnd = () => {
      if (!active) return drop();
      active = false;
      if (!horizontal) return drop();
      horizontal = false;
      swiped = true;
      window.setTimeout(() => {
        swiped = false;
      }, 400);

      const i = index;
      const passed = Math.abs(dx) > w * 0.32;
      const flick = Math.abs(vx) > 0.35 && Math.sign(vx) === Math.sign(dx);
      let target = i;
      if ((passed || flick) && dx < 0 && i < tabs.length - 1) target = i + 1;
      if ((passed || flick) && dx > 0 && i > 0) target = i - 1;

      el.style.transition = prefersReducedMotion()
        ? "none"
        : `transform ${SETTLE_MS}ms ${EASE}`;
      el.style.transform = `translate3d(${-target * 100}%,0,0)`;
      window.setTimeout(drop, SETTLE_MS + 60);

      if (target !== i) {
        selfNav.current = true;
        setIndex(target);
        window.history.pushState(null, "", tabs[target]);
        document.title = titles[target];
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true, capture: true });
    el.addEventListener("touchmove", onMove, { passive: false, capture: true });
    el.addEventListener("touchend", onEnd, { passive: true, capture: true });
    el.addEventListener("touchcancel", onEnd, { passive: true, capture: true });
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("touchstart", onStart, true);
      el.removeEventListener("touchmove", onMove, true);
      el.removeEventListener("touchend", onEnd, true);
      el.removeEventListener("touchcancel", onEnd, true);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [isDetail, isMobile, index, tabs, titles]);

  // Light enter slide for detail routes.
  React.useEffect(() => {
    const el = detailRef.current;
    if (!el || !isDetail || prefersReducedMotion()) return;
    el.style.willChange = "transform, opacity";
    el.style.transition = "none";
    el.style.transform = `translate3d(${PUSH_OFFSET}px,0,0)`;
    el.style.opacity = "0";
    const raf = requestAnimationFrame(() => {
      el.style.transition = `transform ${SETTLE_MS}ms ${EASE}, opacity ${SETTLE_MS}ms ${EASE}`;
      el.style.transform = "translate3d(0,0,0)";
      el.style.opacity = "1";
    });
    const clear = window.setTimeout(() => {
      el.style.willChange = "";
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    }, SETTLE_MS + 60);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clear);
    };
  }, [isDetail, pathname]);

  const ctx = React.useMemo<PagerCtx>(
    () => ({ activeIndex: index, visited }),
    [index, visited],
  );

  return (
    <PagerContext.Provider value={ctx}>
      <main className="relative min-h-0 flex-1">
        <div className={cn("h-full", isDetail && "hidden")}>
          <div className="h-full overflow-hidden">
            <div
              ref={stripRef}
              className="flex h-full"
              style={{ transform: `translate3d(${-index * 100}%,0,0)` }}
            >
              {panes.map((pane, i) => (
                <div key={tabs[i]} className="h-full w-full shrink-0 overflow-hidden">
                  {pane}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "h-full overflow-y-auto overscroll-y-contain",
            !isDetail && "hidden",
          )}
        >
          <div
            ref={detailRef}
            className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] sm:px-6 md:py-8 md:pb-10"
          >
            {children}
          </div>
        </div>
      </main>
    </PagerContext.Provider>
  );
}
