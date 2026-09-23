import { describe, expect, it } from "vitest";

import { buildExport, type ExportWorkout } from "./build";

type Ex = ExportWorkout["exercises"][number];
type S = Ex["sets"][number];

const set = (p: Partial<S> = {}): S => ({
  type: "NORMAL",
  toFailure: false,
  reps: 8,
  seconds: null,
  weight: 60,
  ...p,
});
const ex = (name: string, muscle: string | null, sets: S[], p: Partial<Ex> = {}): Ex => ({
  muscle,
  equipment: null,
  exercise: { name, muscle, equipment: "BARBELL" },
  sets,
  ...p,
});
/** A workout on a local date ("2026-09-21" is a Monday). */
const workout = (day: string, exercises: Ex[], p: Partial<ExportWorkout> = {}) => {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d, 18, 0);
  return {
    date,
    name: null,
    unit: "KG",
    startedAt: date,
    endedAt: null,
    exercises,
    ...p,
  } as ExportWorkout;
};

describe("buildExport — sets per week per muscle group", () => {
  it("counts working sets only — no warm-ups, no sets left empty", () => {
    const data = buildExport(
      [
        workout("2026-09-21", [
          ex("Bench", "Chest", [
            set({ type: "WARMUP" }),
            set(),
            set({ type: "DROP" }),
            set({ reps: 0 }), // never done
          ]),
          ex("Plank", "Core", [set({ reps: 0, seconds: 60, weight: 0 })]), // a hold counts
        ]),
      ],
      "KG",
    );
    expect(data.weekly["2026-09-20"]).toEqual({ Chest: 2, Core: 1 });
    expect(data.sets.map((s) => s.counted)).toEqual([false, true, true, false, true]);
  });

  it("buckets by the Sunday that starts the week, and zero-fills gap weeks", () => {
    const data = buildExport(
      [
        workout("2026-09-05", [ex("Row", "Back", [set()])]), // Sat → week of Aug 30
        workout("2026-09-06", [ex("Row", "Back", [set(), set()])]), // Sun → week of Sep 6
        workout("2026-09-24", [ex("Row", "Back", [set()])]), // two weeks later
      ],
      "KG",
    );
    expect(data.weeks).toEqual(["2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20"]);
    expect(data.weekly["2026-08-30"]).toEqual({ Back: 1 });
    expect(data.weekly["2026-09-06"]).toEqual({ Back: 2 });
    expect(data.weekly["2026-09-13"]).toBeUndefined();
    expect(data.weekly["2026-09-20"]).toEqual({ Back: 1 });
  });

  it("lists muscles head-to-toe, unknown ones last; falls back to the exercise's muscle", () => {
    const data = buildExport(
      [
        workout("2026-09-21", [
          ex("Squat", "Quads", [set()]),
          ex("Carry", "Grip", [set()]),
          ex("Bench", "Chest", [set()]),
          ex("Curl", null, [set()], {
            exercise: { name: "Curl", muscle: "Biceps", equipment: "DUMBBELL" },
          }),
          ex("Mystery", null, [set()], { exercise: null }),
        ]),
      ],
      "KG",
    );
    // "Other" is the app's own last group; a muscle it doesn't know sorts after it.
    expect(data.muscles).toEqual(["Chest", "Biceps", "Quads", "Other", "Grip"]);
  });
});

describe("buildExport — rows", () => {
  it("numbers workouts oldest = 1, whatever order they come in", () => {
    const data = buildExport(
      [
        workout("2026-09-22", [ex("A", "Chest", [set()])], { name: "Later" }),
        workout("2026-09-20", [ex("A", "Chest", [set()])], { name: "Earlier" }),
      ],
      "KG",
    );
    expect(data.workouts.map((w) => [w.number, w.name])).toEqual([
      [1, "Earlier"],
      [2, "Later"],
    ]);
    expect(data.sets.map((s) => s.workout)).toEqual([1, 2]);
  });

  it("converts to the export unit, and totals volume over counted sets only", () => {
    const data = buildExport(
      [
        workout(
          "2026-09-21",
          [
            ex("Bench", "Chest", [
              set({ type: "WARMUP", weight: 40 }),
              set({ weight: 100, reps: 5 }),
            ]),
          ],
          { unit: "KG" },
        ),
      ],
      "LB",
    );
    expect(data.sets.map((s) => s.weight)).toEqual([88.2, 220.5]);
    expect(data.workouts[0].volume).toBeCloseTo(220.5 * 5);
    expect(data.workouts[0].countedSets).toBe(1);
  });

  it("gives each set its equipment (per-workout override first) and position", () => {
    const data = buildExport(
      [
        workout("2026-09-21", [
          ex("Shrug", "Traps", [set(), set({ toFailure: true })], {
            equipment: "DUMBBELL",
          }),
        ]),
      ],
      "KG",
    );
    expect(data.sets.map((s) => [s.equipment, s.set, s.type, s.toFailure])).toEqual([
      ["Dumbbell", 1, "Normal", false],
      ["Dumbbell", 2, "Normal", true],
    ]);
  });

  it("gives a session length only when it was timed", () => {
    const start = new Date(2026, 8, 21, 18, 0);
    const data = buildExport(
      [
        workout("2026-09-21", [], {
          startedAt: start,
          endedAt: new Date(start.getTime() + 72 * 60_000),
        }),
        workout("2026-09-22", []),
      ],
      "KG",
    );
    expect(data.workouts.map((w) => w.minutes)).toEqual([72, null]);
  });

  it("is empty, not broken, with no workouts", () => {
    const data = buildExport([], "KG");
    expect(data).toMatchObject({ sets: [], workouts: [], weeks: [], muscles: [] });
  });
});
