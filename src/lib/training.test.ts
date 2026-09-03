import { describe, expect, it } from "vitest";

import {
  ageFromBirthday,
  best1RM,
  cmToFeetInches,
  convertWeight,
  epley1RM,
  feetInchesToCm,
  formatHeight,
  formatDuration,
  groupLinkedExercises,
  isWorkingSet,
  linkedGroupLabel,
  parseTargetSeconds,
  personalRecords,
  slotLabel,
  startOfWeek,
  topSet,
  weeklyStreak,
  workoutVolume,
} from "./training";

describe("epley1RM", () => {
  it("returns the weight itself for a single rep", () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it("adds ~3.3% per rep (Epley)", () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
  });

  it("is 0 without load or reps", () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
  });
});

describe("convertWeight", () => {
  it("round-trips kg -> lb -> kg", () => {
    const lb = convertWeight(100, "KG", "LB");
    expect(lb).toBeCloseTo(220.46, 1);
    expect(convertWeight(lb, "LB", "KG")).toBeCloseTo(100, 5);
  });

  it("is a no-op for the same unit", () => {
    expect(convertWeight(42, "KG", "KG")).toBe(42);
  });
});

describe("workoutVolume", () => {
  it("sums weight x reps and ignores warm-ups", () => {
    const sets = [
      { weight: 100, reps: 5 },
      { weight: 60, reps: 10, type: "WARMUP" as const },
      { weight: 100, reps: 5 },
    ];
    expect(workoutVolume(sets)).toBe(1000);
  });
});

describe("body helpers", () => {
  it("ageFromBirthday counts whole years", () => {
    const twentyYearsAgo = new Date();
    twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
    twentyYearsAgo.setDate(twentyYearsAgo.getDate() - 1); // birthday already passed
    expect(ageFromBirthday(twentyYearsAgo)).toBe(20);
    expect(ageFromBirthday(null)).toBe(null);
  });

  it("formats height per unit", () => {
    expect(formatHeight(180, "KG")).toBe("180 cm");
    expect(formatHeight(180, "LB")).toBe("5'11\"");
    expect(formatHeight(null, "KG")).toBe("—");
  });

  it("round-trips feet/inches and cm", () => {
    expect(feetInchesToCm(5, 11)).toBe(180);
    expect(cmToFeetInches(180)).toEqual({ ft: 5, in: 11 });
  });
});

describe("isWorkingSet", () => {
  it("counts everything except warm-ups", () => {
    expect(isWorkingSet({ type: "NORMAL" })).toBe(true);
    expect(isWorkingSet({ type: "DROP" })).toBe(true);
    expect(isWorkingSet({ type: "FAILURE" })).toBe(true);
    expect(isWorkingSet({})).toBe(true);
    expect(isWorkingSet({ type: "WARMUP" })).toBe(false);
  });
});

describe("topSet / best1RM", () => {
  const sets = [
    { weight: 80, reps: 8 },
    { weight: 100, reps: 3 },
    { weight: 100, reps: 5 },
    { weight: 120, reps: 10, type: "WARMUP" as const },
  ];

  it("picks the heaviest working set, ties broken by reps", () => {
    expect(topSet(sets)).toEqual({ weight: 100, reps: 5 });
  });

  it("takes the best estimated 1RM across working sets", () => {
    // 100x5 -> 116.7 beats 80x8 -> 101.3 and 100x3 -> 110
    expect(best1RM(sets)).toBeCloseTo(116.67, 1);
  });
});

describe("personalRecords", () => {
  it("tracks all-time bests and the date of the best 1RM", () => {
    const prs = personalRecords([
      { date: "2026-01-01", best1RM: 100, topSetWeight: 90, volume: 2000 },
      { date: "2026-01-08", best1RM: 110, topSetWeight: 100, volume: 1800 },
      { date: "2026-01-15", best1RM: 108, topSetWeight: 105, volume: 2400 },
    ]);
    expect(prs).toEqual({
      best1RM: 110,
      maxWeight: 105,
      bestVolume: 2400,
      best1RMDate: "2026-01-08",
    });
  });
});

describe("startOfWeek", () => {
  it("returns the Sunday of the week at local midnight", () => {
    // 2026-09-02 is a Wednesday; its week starts Sunday 2026-08-30
    const sun = startOfWeek(new Date("2026-09-02T15:30:00"));
    expect(sun.getFullYear()).toBe(2026);
    expect(sun.getMonth()).toBe(7); // August
    expect(sun.getDate()).toBe(30);
    expect(sun.getHours()).toBe(0);
  });

  it("returns the same day for a Sunday", () => {
    const sun = startOfWeek(new Date("2026-09-06T12:00:00")); // Sunday
    expect(sun.getMonth()).toBe(8); // September
    expect(sun.getDate()).toBe(6);
  });

  it("treats Saturday as the last day of the same week", () => {
    const sat = startOfWeek(new Date("2026-09-05T12:00:00")); // Saturday
    expect(sat.getMonth()).toBe(7); // back to Sunday 30 Aug
    expect(sat.getDate()).toBe(30);
  });
});

describe("weeklyStreak", () => {
  const now = new Date("2026-09-02T12:00:00"); // Wednesday

  it("is 0 with no workouts", () => {
    expect(weeklyStreak([], now)).toBe(0);
  });

  it("counts consecutive weeks back from this week", () => {
    const dates = [
      new Date("2026-09-01"), // this week
      new Date("2026-08-26"), // last week
      new Date("2026-08-18"), // two weeks ago
    ];
    expect(weeklyStreak(dates, now)).toBe(3);
  });

  it("still counts when this week is missing but last week is present", () => {
    expect(weeklyStreak([new Date("2026-08-26")], now)).toBe(1);
  });

  it("breaks on a two-week gap", () => {
    const dates = [new Date("2026-08-26"), new Date("2026-08-05")];
    expect(weeklyStreak(dates, now)).toBe(1);
  });
});

describe("formatDuration", () => {
  it("renders m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(605)).toBe("10:05");
  });
});

describe("parseTargetSeconds", () => {
  it("reads plain, suffixed, and clock formats", () => {
    expect(parseTargetSeconds("45")).toBe(45);
    expect(parseTargetSeconds("60s")).toBe(60);
    expect(parseTargetSeconds("1:30")).toBe(90);
    expect(parseTargetSeconds(null)).toBe(60);
    expect(parseTargetSeconds("8-12")).toBe(8);
  });
});

describe("groupLinkedExercises", () => {
  const row = (id: string, linkToNext: "SUPERSET" | "DROP_SET" | null) => ({
    id,
    linkToNext,
  });

  it("keeps unlinked exercises as groups of one", () => {
    const groups = groupLinkedExercises([row("a", null), row("b", null)]);
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([["a"], ["b"]]);
  });

  it("bundles a run chained by linkToNext", () => {
    const groups = groupLinkedExercises([
      row("a", "SUPERSET"),
      row("b", "SUPERSET"),
      row("c", null),
      row("d", null),
    ]);
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("ignores a trailing link on the last exercise", () => {
    const groups = groupLinkedExercises([row("a", null), row("b", "SUPERSET")]);
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([["a"], ["b"]]);
  });
});

describe("linkedGroupLabel", () => {
  it("names a uniform group by its link type", () => {
    expect(linkedGroupLabel([{ linkToNext: "SUPERSET" }, { linkToNext: null }])).toBe(
      "Superset",
    );
    expect(linkedGroupLabel([{ linkToNext: "DROP_SET" }, { linkToNext: null }])).toBe(
      "Drop set",
    );
  });

  it("calls a mixed group a circuit", () => {
    expect(
      linkedGroupLabel([
        { linkToNext: "SUPERSET" },
        { linkToNext: "DROP_SET" },
        { linkToNext: null },
      ]),
    ).toBe("Circuit");
  });
});

describe("slotLabel", () => {
  it("is the muscle group, or a fallback", () => {
    expect(slotLabel("Chest")).toBe("Chest");
    expect(slotLabel(null)).toBe("Exercise");
    expect(slotLabel(undefined)).toBe("Exercise");
  });
});
