"use client";

import * as React from "react";

/**
 * Works around an iOS bug in apps added to the Home Screen: after the
 * on-screen keyboard has been open, iOS can leave the app's viewport short by
 * the status-bar height — `innerHeight`, `100dvh` and `position: fixed` all
 * shrink — so the tab bar floats ~60pt up over a dead band at the bottom, and
 * it stays that way until the app is force-quit.
 *
 * Nothing prevents it, but WebKit re-measures the viewport if the full-height
 * page is taken out of layout and put back. So once no field is focused (the
 * keyboard is down), if the viewport is shorter than the screen, do that —
 * synchronously, so nothing paints in between — and put every scroll position
 * back. iPhone Home Screen apps only; Safari tabs and other platforms never
 * run it.
 */
export function ViewportHealer() {
  React.useEffect(() => {
    if (!isIPhoneHomeScreenApp()) return;

    let timer = 0;
    let lastTried = -1;
    const check = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const h = window.innerHeight;
        if (!viewportIsStuck(h, expectedHeight(), isTyping())) return;
        // One attempt per stuck height, so a heal that doesn't take can't loop.
        if (h === lastTried) return;
        lastTried = h;
        remeasure();
      }, delay);
    };

    const onFocusOut = () => check(160); // let the keyboard finish closing
    const onResize = () => check(250);
    const onShow = () => {
      if (document.visibilityState === "visible") {
        lastTried = -1;
        check(300);
      }
    };

    check(500);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  return null;
}

/**
 * Whether the viewport is short of the screen by more than rounding — and not
 * because the keyboard is up (a focused field is the keyboard's business).
 */
export function viewportIsStuck(
  innerHeight: number,
  screenHeight: number,
  typing: boolean,
) {
  return !typing && screenHeight - innerHeight > 4;
}

/** Take the page out of layout and back, keeping every scroll position. */
export function remeasure(doc: Document = document) {
  const scrolled: [Element, number][] = [];
  doc.querySelectorAll("*").forEach((el) => {
    if (el.scrollTop > 0) scrolled.push([el, el.scrollTop]);
  });
  const pageY = doc.defaultView?.scrollY ?? 0;

  const body = doc.body;
  const display = body.style.display;
  body.style.display = "none";
  void body.offsetHeight; // force layout with the page gone
  body.style.display = display;
  void body.offsetHeight;

  for (const [el, top] of scrolled) el.scrollTop = top;
  if (pageY) doc.defaultView?.scrollTo(0, pageY);
}

function isIPhoneHomeScreenApp() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPads get windowed (Split View, Stage Manager), where a viewport smaller
  // than the screen is normal — so only iPhones.
  return standalone && /iPhone|iPod/.test(navigator.userAgent);
}

/** The full screen height in the current orientation (iOS doesn't rotate `screen`). */
function expectedHeight() {
  const { width, height } = window.screen;
  return window.matchMedia("(orientation: portrait)").matches
    ? Math.max(width, height)
    : Math.min(width, height);
}

function isTyping() {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "submit", "reset", "file"].includes(
      el.type,
    );
  }
  return el instanceof HTMLElement && el.isContentEditable;
}
