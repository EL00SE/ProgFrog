// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildExport, type ExportWorkout } from "./build";
import { colLetter, writeWorkbook } from "./workbook";

const day = (d: number) => new Date(2026, 8, d, 18, 0);
const w = (d: number, muscle: string, sets: number, warmups = 0): ExportWorkout => ({
  date: day(d),
  name: `Day ${d}`,
  unit: "KG",
  startedAt: day(d),
  endedAt: null,
  exercises: [
    {
      muscle,
      equipment: null,
      exercise: { name: `${muscle} lift`, muscle, equipment: "BARBELL" },
      sets: [
        ...Array.from({ length: warmups }, () => ({
          type: "WARMUP" as const,
          toFailure: false,
          reps: 10,
          seconds: null,
          weight: 20,
        })),
        ...Array.from({ length: sets }, () => ({
          type: "NORMAL" as const,
          toFailure: false,
          reps: 5,
          seconds: null,
          weight: 100,
        })),
      ],
    },
  ],
});

async function open(workouts: ExportWorkout[]) {
  const bytes = await writeWorkbook(buildExport(workouts, "KG"));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  return wb;
}

const formula = (c: ExcelJS.Cell) => (c.value as ExcelJS.CellFormulaValue).formula;
// ExcelJS's *reader* drops a cached 0 (the file does hold `<v>0</v>` — checked
// in the raw XML), so read a missing result back as 0.
const result = (c: ExcelJS.Cell) => (c.value as ExcelJS.CellFormulaValue).result ?? 0;

describe("writeWorkbook", () => {
  // Sep 21 & 22 are one week (from Sun Sep 20); Sep 28 the next.
  const history = [w(21, "Chest", 3, 1), w(22, "Back", 4), w(28, "Chest", 2)];

  it("has the three sheets, headline first", async () => {
    const wb = await open(history);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Weekly sets", "Workouts", "Sets"]);
  });

  it("weekly sets: a week per row, a muscle per column, each a COUNTIFS with its value", async () => {
    const ws = (await open(history)).getWorksheet("Weekly sets")!;
    expect(ws.getRow(1).values).toEqual([undefined, "Week of", "Chest", "Back", "Total"]);

    const week1 = ws.getRow(2);
    expect((week1.getCell(1).value as Date).toISOString()).toBe(
      "2026-09-20T00:00:00.000Z",
    );
    expect(formula(week1.getCell(2))).toBe(
      'COUNTIFS(Sets!$B$2:$B$11,$A2,Sets!$F$2:$F$11,B$1,Sets!$N$2:$N$11,"Yes")',
    );
    // 3 working chest sets — the warm-up isn't counted.
    expect([2, 3, 4].map((c) => result(week1.getCell(c)))).toEqual([3, 4, 7]);
    expect(formula(week1.getCell(4))).toBe("SUM(B2:C2)");

    const week2 = ws.getRow(3);
    expect([2, 3, 4].map((c) => result(week2.getCell(c)))).toEqual([2, 0, 2]);

    // Totals and averages under the table.
    expect(ws.getRow(4).getCell(1).value).toBe("Total");
    expect(formula(ws.getRow(4).getCell(2))).toBe("SUM(B2:B3)");
    expect([2, 3, 4].map((c) => result(ws.getRow(4).getCell(c)))).toEqual([5, 4, 9]);
    expect(formula(ws.getRow(5).getCell(4))).toBe("AVERAGE(D2:D3)");
    expect(result(ws.getRow(5).getCell(4))).toBe(4.5);
  });

  it("sets: every set, with Counted marking what the weekly counts include", async () => {
    const ws = (await open(history)).getWorksheet("Sets")!;
    expect(ws.rowCount).toBe(1 + 10); // 1 warm-up + 3 + 4 + 2
    expect(ws.getCell("N1").value).toBe("Counted");
    expect(ws.getCell("F2").value).toBe("Chest");
    expect(ws.getCell("I2").value).toBe("Warm-up");
    expect(ws.getCell("N2").value).toBe("No");
    expect(ws.getCell("N3").value).toBe("Yes");
    expect(ws.getCell("K1").value).toBe("Weight (kg)");
  });

  it("workouts: working sets and volume as formulas over the Sets sheet", async () => {
    const ws = (await open(history)).getWorksheet("Workouts")!;
    const first = ws.getRow(2);
    expect(first.getCell(2).value).toBe(1);
    expect(formula(first.getCell(6))).toBe(
      'COUNTIFS(Sets!$C$2:$C$11,B2,Sets!$N$2:$N$11,"Yes")',
    );
    expect(result(first.getCell(6))).toBe(3);
    expect(formula(first.getCell(7))).toBe(
      'SUMPRODUCT((Sets!$C$2:$C$11=B2)*(Sets!$N$2:$N$11="Yes")*Sets!$K$2:$K$11*Sets!$L$2:$L$11)',
    );
    expect(result(first.getCell(7))).toBe(3 * 100 * 5);
  });

  it("says so instead of drawing an empty table when there's nothing logged", async () => {
    const ws = (await open([])).getWorksheet("Weekly sets")!;
    expect(ws.getCell("A3").value).toMatch(/No working sets logged yet/);
  });
});

describe("colLetter", () => {
  it("counts like spreadsheet columns", () => {
    expect([1, 2, 26, 27, 52, 53, 702, 703].map(colLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AZ",
      "BA",
      "ZZ",
      "AAA",
    ]);
  });
});
