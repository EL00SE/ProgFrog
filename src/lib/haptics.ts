/**
 * Haptic feedback that works on both platforms:
 *
 * - **Android / Chrome**: the Vibration API.
 * - **iPhone**: Safari has no Vibration API, but since iOS 18 toggling a
 *   `<input type="checkbox" switch>` plays the system selection tick — so a
 *   hidden one is toggled instead. Each tick is one light "click"; a pattern
 *   plays one per pulse.
 *
 * Silent everywhere else (desktop). Call it from a tap handler — iOS only
 * plays it inside (or shortly after) a user gesture. Callers don't need to guard.
 */
export function haptic(pattern: number | number[] = 10) {
  if (typeof window === "undefined") return;
  if (canVibrate()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* some browsers throw if called outside a user gesture */
    }
    return;
  }
  if (!isIOS()) return;
  // Pulses start at 0 and after each on+off pair: [30, 60, 30] → ticks at 0, 90ms.
  const pulses = Array.isArray(pattern) ? pattern : [pattern];
  let at = 0;
  for (let i = 0; i < pulses.length; i += 2) {
    if (at === 0) iosTick();
    else window.setTimeout(iosTick, at);
    at += (pulses[i] ?? 0) + (pulses[i + 1] ?? 0);
  }
}

/** A value picked or nudged (stepper, set type, choice) — the lightest tick. */
export const tick = () => haptic(8);
/** Something added or removed (a set, an exercise, a day). */
export const thud = () => haptic(15);

function canVibrate() {
  return typeof navigator.vibrate === "function";
}

let ios: boolean | undefined;
function isIOS() {
  // iPadOS reports itself as a Mac; the touch points give it away.
  ios ??=
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios;
}

function iosTick() {
  try {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    // In <head>, away from the app's own elements: no layout, no focus change,
    // and no app handler matches the click.
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* no haptics then */
  }
}
