/**
 * A tiny wrapper over the Vibration API. No-ops where it isn't supported
 * (desktop, iOS Safari) — callers don't need to guard.
 */
export function haptic(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw if called outside a user gesture */
  }
}
