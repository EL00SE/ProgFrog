import { describe, expect, it } from "vitest";

import { revealDelta } from "./use-keyboard-avoidance";

// A phone with the keyboard up: 500px of the layout is still visible.
const visible = { top: 0, bottom: 500 };
const field = (top: number, height = 40) => ({ top, bottom: top + height });

describe("revealDelta", () => {
  it("leaves a field that's already comfortably in view alone", () => {
    expect(revealDelta(field(120), visible)).toBe(0);
    expect(revealDelta(field(8), visible)).toBe(0);
  });

  it("scrolls a field hidden behind the keyboard up into the clear zone", () => {
    const delta = revealDelta(field(600), visible);
    expect(delta).toBeGreaterThan(0);
    // Once scrolled it sits inside the zone, clear of the bottom reserve.
    const after = field(600 - delta);
    expect(after.top).toBeGreaterThanOrEqual(8);
    expect(after.bottom).toBeLessThanOrEqual(500 - 96);
  });

  it("treats a field sitting in the bottom reserve (under the tab bar) as hidden", () => {
    expect(revealDelta(field(440), visible)).toBeGreaterThan(0);
  });

  it("scrolls a field that's above the visible area back down", () => {
    const delta = revealDelta(field(-50), visible);
    expect(delta).toBeLessThan(0);
    expect(field(-50 - delta).top).toBeGreaterThanOrEqual(8);
  });

  it("measures against the visual viewport's own offset", () => {
    // iOS has panned the page 200px: what's visible is 200–700.
    expect(revealDelta(field(300), { top: 200, bottom: 700 })).toBe(0);
    expect(revealDelta(field(120), { top: 200, bottom: 700 })).toBeLessThan(0);
  });

  it("lines a field taller than the clear zone up at the top edge", () => {
    const tall = field(300, 600);
    expect(tall.bottom - tall.top).toBeGreaterThan(500 - 96 - 8);
    expect(revealDelta(tall, visible)).toBe(300 - 8);
  });
});
