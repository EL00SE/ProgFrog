/**
 * Shared enter / exit motion for list rows, so adding and removing things
 * feels the same everywhere. Enter is a short fade-and-drop; exit fades and
 * shrinks, then the caller removes the row after `exitDelay()`.
 */

/** A freshly added row. */
export const enterRowCls =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200";

/** A row on its way out — holds its end state until it's removed. */
export const exitCls =
  "pointer-events-none animate-out fade-out-0 zoom-out-95 fill-mode-forwards duration-150";

/** How long to let `exitCls` play before removing the row. */
export function exitDelay() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : 150;
}
