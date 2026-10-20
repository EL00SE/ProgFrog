import { describe, expect, it } from "vitest";

import { remeasure, viewportIsStuck } from "./viewport-healer";

describe("viewportIsStuck", () => {
  it("is stuck when the viewport is short of the screen with no keyboard up", () => {
    // iPhone 16 Pro: 874pt screen, left 62pt short (the status bar's height).
    expect(viewportIsStuck(812, 874, false)).toBe(true);
  });

  it("isn't while a field is focused — that's the keyboard", () => {
    expect(viewportIsStuck(500, 874, true)).toBe(false);
  });

  it("ignores rounding", () => {
    expect(viewportIsStuck(874, 874, false)).toBe(false);
    expect(viewportIsStuck(871, 874, false)).toBe(false);
  });
});

describe("remeasure", () => {
  it("takes the page out of layout and back, keeping scroll positions", () => {
    document.body.innerHTML = `<div id="pane" style="height:100px;overflow-y:auto"><div style="height:1000px"></div></div>`;
    const pane = document.getElementById("pane")!;
    pane.scrollTop = 240;
    const seen: string[] = [];
    const style = document.body.style;
    const orig = Object.getOwnPropertyDescriptor(
      CSSStyleDeclaration.prototype,
      "display",
    );
    Object.defineProperty(style, "display", {
      configurable: true,
      get: () => style.getPropertyValue("display"),
      set: (v: string) => {
        seen.push(v);
        style.setProperty("display", v);
      },
    });
    remeasure(document);
    expect(seen).toEqual(["none", ""]);
    expect(document.body.style.display).toBe("");
    expect(pane.scrollTop).toBe(240);
    if (orig) delete (style as unknown as Record<string, unknown>).display;
  });
});
