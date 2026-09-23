import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installPressFeedback, MIN_HOLD_MS, SLOP_PX } from "./press-feedback";

// jsdom has no PointerEvent; a MouseEvent of the same type carries what's read.
function pointer(type: string, target: Element, x = 10, y = 10) {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, "pointerType", { value: "touch" });
  target.dispatchEvent(e);
}

describe("installPressFeedback", () => {
  let uninstall: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <a href="/w/1" id="card"><div id="inside"><button id="btn">Edit</button></div></a>
      <button id="off" disabled>Off</button>
      <div id="plain">text</div>
      <div data-no-press><button id="opted-out">x</button></div>`;
    uninstall = installPressFeedback(document);
  });
  afterEach(() => {
    uninstall();
    vi.useRealTimers();
  });

  const $ = (id: string) => document.getElementById(id)!;
  const pressed = (id: string) => $(id).hasAttribute("data-pressed");

  it("presses the innermost pressable under the pointer", () => {
    pointer("pointerdown", $("btn"));
    expect(pressed("btn")).toBe(true);
    expect(pressed("card")).toBe(false);
  });

  it("presses a card link from anywhere inside it", () => {
    pointer("pointerdown", $("inside"));
    expect(pressed("card")).toBe(true);
  });

  it("keeps a quick tap pressed long enough to be seen", () => {
    pointer("pointerdown", $("btn"));
    pointer("pointerup", $("btn"));
    expect(pressed("btn")).toBe(true);
    vi.advanceTimersByTime(MIN_HOLD_MS);
    expect(pressed("btn")).toBe(false);
  });

  it("lets go at once when the finger starts to scroll or swipe", () => {
    pointer("pointerdown", $("inside"), 10, 10);
    pointer("pointermove", $("inside"), 10, 10 + SLOP_PX / 2);
    expect(pressed("card")).toBe(true);
    pointer("pointermove", $("inside"), 10, 10 + SLOP_PX + 1);
    expect(pressed("card")).toBe(false);
  });

  it("lets go at once on a cancelled touch or a scroll", () => {
    pointer("pointerdown", $("btn"));
    pointer("pointercancel", $("btn"));
    expect(pressed("btn")).toBe(false);
    pointer("pointerdown", $("btn"));
    document.dispatchEvent(new Event("scroll"));
    expect(pressed("btn")).toBe(false);
  });

  it("ignores disabled controls, plain content, and opted-out areas", () => {
    pointer("pointerdown", $("off"));
    pointer("pointerdown", $("plain"));
    pointer("pointerdown", $("opted-out"));
    expect(document.querySelector("[data-pressed]")).toBeNull();
  });

  it("a fresh press isn't cut short by the previous tap's release", () => {
    pointer("pointerdown", $("btn"));
    pointer("pointerup", $("btn"));
    vi.advanceTimersByTime(MIN_HOLD_MS / 2);
    pointer("pointerdown", $("btn"));
    vi.advanceTimersByTime(MIN_HOLD_MS);
    expect(pressed("btn")).toBe(true);
  });
});
