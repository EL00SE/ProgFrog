"use client";

import * as React from "react";

// The bottom of the visible area is kept clear of fields: the tab bar and the
// floating buttons ride there once the keyboard is up (Android shrinks the
// layout for it, so they sit right on top of it).
const BOTTOM_RESERVE = 96;
const TOP_GAP = 8;
// Below this, a gap between the layout and visual viewport is browser chrome
// (collapsing toolbars), not a keyboard.
const KEYBOARD_MIN = 120;

const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function raisesKeyboard(el: EventTarget | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return null;
}

type Span = { top: number; bottom: number };

/**
 * How far to scroll (px, positive = down) so a focused field sits clear of the
 * on-screen keyboard. 0 when it's already comfortably in view — a field that's
 * fine where it is never gets nudged.
 */
export function revealDelta(field: Span, visible: Span): number {
  const zoneTop = visible.top + TOP_GAP;
  const zoneBottom = visible.bottom - BOTTOM_RESERVE;
  if (field.top >= zoneTop && field.bottom <= zoneBottom) return 0;
  // Centre it in the clear zone (a field taller than the zone lines up at the
  // top instead) so the label / exercise above it stays in view too.
  const spare = zoneBottom - zoneTop - (field.bottom - field.top);
  return Math.round(field.top - (zoneTop + Math.max(0, spare / 2)));
}

/**
 * Keeps the field being typed in visible on a phone. Attach `ref` to a
 * container: when a text field inside it takes focus, its scroll container is
 * scrolled so the field lands above the on-screen keyboard.
 *
 * Also returns the keyboard's height. iOS Safari doesn't shrink the layout for
 * the keyboard, so the caller should add that much room at the end of the
 * scroll area — otherwise the last fields have nothing to scroll into.
 */
export function useKeyboardAvoidance<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const field = React.useRef<HTMLElement | null>(null);
  const frame = React.useRef(0);
  const [inset, setInset] = React.useState(0);

  const reveal = React.useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = field.current;
      if (!el?.isConnected || vv.scale > 1.01) return;
      const scroller = scrollParent(el);
      if (!scroller) return;
      const delta = revealDelta(el.getBoundingClientRect(), {
        top: vv.offsetTop,
        bottom: vv.offsetTop + vv.height,
      });
      if (!delta) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scroller.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
    });
  }, []);

  React.useEffect(() => {
    const root = ref.current;
    const vv = window.visualViewport;
    if (!root || !vv) return;

    let settle = 0;
    const onFocusIn = (e: FocusEvent) => {
      if (!raisesKeyboard(e.target)) return;
      field.current = e.target;
      reveal();
      // The keyboard is still sliding in — check again once it has landed.
      window.clearTimeout(settle);
      settle = window.setTimeout(reveal, 350);
    };
    const onFocusOut = () => {
      field.current = null;
    };
    const onViewport = () => {
      const raw = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      setInset(vv.scale > 1.01 || raw < KEYBOARD_MIN ? 0 : raw);
      reveal();
    };

    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    vv.addEventListener("resize", onViewport);
    vv.addEventListener("scroll", onViewport);
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      vv.removeEventListener("resize", onViewport);
      vv.removeEventListener("scroll", onViewport);
      window.clearTimeout(settle);
      cancelAnimationFrame(frame.current);
    };
  }, [reveal]);

  // The extra room the caller renders for `inset` changes the scroll range —
  // re-check once it's laid out so the field isn't left short of where it goes.
  React.useEffect(() => {
    if (inset > 0) reveal();
  }, [inset, reveal]);

  return { ref, inset };
}
