"use client";

import * as React from "react";

/**
 * Anything a tap can land on. The innermost match wins, so a button inside a
 * card link presses the button, not the card.
 */
const PRESSABLE = [
  "button:not(:disabled)",
  "a[href]",
  "select:not(:disabled)",
  "[role=button]:not([aria-disabled=true])",
  "[role=tab]",
  "[role=menuitem]",
  "[role=option]",
  "summary",
  "[data-pressable]",
].join(",");

/** A tap shorter than this still shows as pressed for this long. */
export const MIN_HOLD_MS = 90;
/** Movement past this is a scroll or swipe, not a tap — the press lets go. */
export const SLOP_PX = 10;

/**
 * Marks the element under a finger (or mouse) with `data-pressed` for as long
 * as it's held — styled with Tailwind's `data-pressed:` variant.
 *
 * `:active` alone isn't enough on a phone: a quick tap lets go before the
 * pressed style has painted, and a drag that starts on a card lights it up as
 * if tapped. This holds a short tap for a couple of frames so it's always
 * seen, and drops the press the moment the finger starts to scroll or swipe.
 */
export function installPressFeedback(doc: Document = document) {
  let el: HTMLElement | null = null;
  let token = 0;
  let x = 0;
  let y = 0;
  let at = 0;

  const release = (immediately: boolean) => {
    const target = el;
    el = null;
    if (!target) return;
    const mine = String(token);
    const clear = () => {
      // A newer press of the same element owns the attribute now.
      if (target.getAttribute("data-pressed") === mine) {
        target.removeAttribute("data-pressed");
      }
    };
    const wait = immediately ? 0 : MIN_HOLD_MS - (performance.now() - at);
    if (wait > 0) window.setTimeout(clear, wait);
    else clear();
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    release(true);
    const hit = (e.target as Element | null)?.closest?.(PRESSABLE);
    if (!(hit instanceof HTMLElement) || hit.closest("[data-no-press]")) return;
    el = hit;
    token += 1;
    x = e.clientX;
    y = e.clientY;
    at = performance.now();
    hit.setAttribute("data-pressed", String(token));
  };
  const onMove = (e: PointerEvent) => {
    if (el && Math.hypot(e.clientX - x, e.clientY - y) > SLOP_PX) release(true);
  };
  const onUp = () => release(false);
  const onCancel = () => release(true);

  const opts = { capture: true, passive: true } as const;
  doc.addEventListener("pointerdown", onDown, opts);
  doc.addEventListener("pointermove", onMove, opts);
  doc.addEventListener("pointerup", onUp, opts);
  doc.addEventListener("pointercancel", onCancel, opts);
  // A scroll that starts under the finger (iOS doesn't always cancel first).
  doc.addEventListener("scroll", onCancel, opts);
  window.addEventListener("blur", onCancel);
  return () => {
    doc.removeEventListener("pointerdown", onDown, opts);
    doc.removeEventListener("pointermove", onMove, opts);
    doc.removeEventListener("pointerup", onUp, opts);
    doc.removeEventListener("pointercancel", onCancel, opts);
    doc.removeEventListener("scroll", onCancel, opts);
    window.removeEventListener("blur", onCancel);
    release(true);
  };
}

/** Mount once, at the root. Renders nothing. */
export function PressFeedback() {
  React.useEffect(() => installPressFeedback(), []);
  return null;
}
