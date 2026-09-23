import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `haptics` caches its platform check, so each test loads a fresh copy.
async function load() {
  vi.resetModules();
  return import("./haptics");
}

function setUA(ua: string, touchPoints = 0) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: touchPoints,
    configurable: true,
  });
}

/** Count the hidden iOS switch toggles by watching clicks on `<input switch>`. */
function countSwitchClicks() {
  const seen = { n: 0 };
  const onClick = (e: Event) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.hasAttribute("switch")) seen.n++;
  };
  document.addEventListener("click", onClick, true);
  return { seen, stop: () => document.removeEventListener("click", onClick, true) };
}

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

describe("haptic", () => {
  let vibrate: PropertyDescriptor | undefined;
  beforeEach(() => {
    vibrate = Object.getOwnPropertyDescriptor(navigator, "vibrate");
  });
  afterEach(() => {
    if (vibrate) Object.defineProperty(navigator, "vibrate", vibrate);
    else delete (navigator as { vibrate?: unknown }).vibrate;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses the Vibration API where there is one", async () => {
    const spy = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { value: spy, configurable: true });
    const { haptic } = await load();
    haptic([30, 60, 30]);
    expect(spy).toHaveBeenCalledWith([30, 60, 30]);
  });

  it("toggles a hidden switch on iPhone, and leaves nothing behind", async () => {
    delete (navigator as { vibrate?: unknown }).vibrate;
    setUA(IPHONE, 5);
    const { tick } = await load();
    const { seen, stop } = countSwitchClicks();
    tick();
    stop();
    expect(seen.n).toBe(1);
    expect(document.querySelector("input[switch]")).toBeNull();
  });

  it("plays one tick per pulse of a pattern on iPhone", async () => {
    vi.useFakeTimers();
    delete (navigator as { vibrate?: unknown }).vibrate;
    setUA(IPHONE, 5);
    const { haptic } = await load();
    const { seen, stop } = countSwitchClicks();
    haptic([30, 60, 30]);
    expect(seen.n).toBe(1);
    vi.advanceTimersByTime(90);
    stop();
    expect(seen.n).toBe(2);
  });

  it("treats a touch 'Macintosh' as an iPad", async () => {
    delete (navigator as { vibrate?: unknown }).vibrate;
    setUA(IPAD_AS_MAC, 5);
    const { tick } = await load();
    const { seen, stop } = countSwitchClicks();
    tick();
    stop();
    expect(seen.n).toBe(1);
  });

  it("stays silent on a desktop browser with no vibration", async () => {
    delete (navigator as { vibrate?: unknown }).vibrate;
    setUA(IPAD_AS_MAC, 0);
    const { tick } = await load();
    const { seen, stop } = countSwitchClicks();
    tick();
    stop();
    expect(seen.n).toBe(0);
  });
});
