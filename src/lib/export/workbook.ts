import ExcelJS from "exceljs";

import type { ExportData, SetRow } from "@/lib/export/build";

/**
 * Writes the export as an Excel workbook:
 *
 * - **Weekly sets** — counted sets per muscle group per week (the dashboard
 *   grid, over your whole history). Each count is a COUNTIFS over the Sets
 *   sheet, so it stays right if you edit or delete rows there.
 * - **Workouts** — one row per finished workout; its set count and volume are
 *   formulas over the Sets sheet too.
 * - **Sets** — every logged set: the raw data, filterable, ready for your own
 *   pivot tables.
 *
 * Every formula carries its computed value as well, so phone previewers that
 * don't calculate (iOS Quick Look, Files) still show the numbers.
 */

const FONT = { name: "Arial", size: 10 } as const;
const HEADER_FILL = "FFF3E6CC";
const HEADER_LINE = "FFD9C6A0";
const NOTE_COLOR = "FF7A6A55";
const HEAT_MAX = "FFE3A857";
const DATE_FMT = "d mmm yyyy";

/** Sets-sheet columns, in order. Other sheets' formulas refer to these letters. */
const SET_COLUMNS = [
  { key: "date", header: "Date", width: 12 },
  { key: "week", header: "Week of", width: 12 },
  { key: "workout", header: "Workout #", width: 10 },
  { key: "workoutName", header: "Workout", width: 26 },
  { key: "exercise", header: "Exercise", width: 26 },
  { key: "muscle", header: "Muscle", width: 12 },
  { key: "equipment", header: "Equipment", width: 12 },
  { key: "set", header: "Set", width: 6 },
  { key: "type", header: "Type", width: 9 },
  { key: "toFailure", header: "To failure", width: 10 },
  { key: "weight", header: "Weight", width: 10 },
  { key: "reps", header: "Reps", width: 7 },
  { key: "seconds", header: "Seconds", width: 9 },
  { key: "counted", header: "Counted", width: 10 },
] as const satisfies readonly { key: keyof SetRow; header: string; width: number }[];

const setCol = (key: (typeof SET_COLUMNS)[number]["key"]) =>
  colLetter(SET_COLUMNS.findIndex((c) => c.key === key) + 1);

export async function writeWorkbook(data: ExportData, generatedAt = new Date()) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProgFrog";
  wb.created = generatedAt;

  const unit = data.unit.toLowerCase();
  const lastSetRow = data.sets.length + 1;
  // Absolute Sets-sheet ranges, e.g. `Sets!$F$2:$F$812`.
  const range = (key: Parameters<typeof setCol>[0]) =>
    `Sets!$${setCol(key)}$2:$${setCol(key)}$${lastSetRow}`;

  weeklySheet(wb.addWorksheet("Weekly sets"), data, range);
  workoutsSheet(wb.addWorksheet("Workouts"), data, unit, range);
  setsSheet(wb.addWorksheet("Sets"), data, unit);

  return new Uint8Array(await wb.xlsx.writeBuffer());
}

// --- Weekly sets --------------------------------------------------------------

function weeklySheet(
  ws: ExcelJS.Worksheet,
  data: ExportData,
  range: (key: Parameters<typeof setCol>[0]) => string,
) {
  const { weeks, muscles, weekly } = data;
  header(ws, ["Week of", ...muscles, "Total"]);
  ws.getColumn(1).width = 13;
  muscles.forEach(
    (_, i) => (ws.getColumn(i + 2).width = Math.max(9, muscles[i].length + 2)),
  );
  ws.getColumn(muscles.length + 2).width = 9;
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  if (weeks.length === 0 || muscles.length === 0) {
    note(ws, 3, "No working sets logged yet — finish a workout and export again.");
    return;
  }

  const first = 2;
  const last = weeks.length + 1;
  const lastMuscle = colLetter(muscles.length + 1);
  const totalCol = muscles.length + 2;

  weeks.forEach((week, i) => {
    const r = first + i;
    const row = ws.getRow(r);
    cell(row.getCell(1), excelDate(week), DATE_FMT);
    let rowTotal = 0;
    muscles.forEach((m, j) => {
      const c = colLetter(j + 2);
      const n = weekly[week]?.[m] ?? 0;
      rowTotal += n;
      cell(row.getCell(j + 2), {
        formula: `COUNTIFS(${range("week")},$A${r},${range("muscle")},${c}$1,${range("counted")},"Yes")`,
        result: n,
      });
    });
    cell(row.getCell(totalCol), {
      formula: `SUM(B${r}:${lastMuscle}${r})`,
      result: rowTotal,
    });
    row.getCell(totalCol).font = { ...FONT, bold: true };
  });

  // Totals and weekly averages under the table.
  const colSums = [...muscles, "Total"].map((m, j) =>
    weeks.reduce(
      (s, w) =>
        s +
        (j < muscles.length
          ? (weekly[w]?.[m] ?? 0)
          : muscles.reduce((t, mm) => t + (weekly[w]?.[mm] ?? 0), 0)),
      0,
    ),
  );
  const totalRow = ws.getRow(last + 1);
  const avgRow = ws.getRow(last + 2);
  cell(totalRow.getCell(1), "Total");
  cell(avgRow.getCell(1), "Average per week");
  colSums.forEach((sum, j) => {
    const c = colLetter(j + 2);
    cell(totalRow.getCell(j + 2), {
      formula: `SUM(${c}${first}:${c}${last})`,
      result: sum,
    });
    cell(
      avgRow.getCell(j + 2),
      { formula: `AVERAGE(${c}${first}:${c}${last})`, result: sum / weeks.length },
      "0.0",
    );
  });
  for (const row of [totalRow, avgRow]) row.font = { ...FONT, bold: true };
  totalRow.eachCell((c) => {
    c.border = { top: { style: "thin", color: { argb: HEADER_LINE } } };
  });

  // A heatmap over the counts, like the dashboard grid.
  ws.addConditionalFormatting({
    ref: `B${first}:${lastMuscle}${last}`,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "num", value: 0 }, { type: "max" }],
        color: [{ argb: "FFFFFFFF" }, { argb: HEAT_MAX }],
      },
    ],
  });

  note(
    ws,
    last + 4,
    "Working sets per muscle group, per week (Sunday–Saturday), as on the dashboard. " +
      "Warm-ups, and sets with no reps or hold time logged, don't count.",
  );
  note(
    ws,
    last + 5,
    'Each count is a formula over the Sets sheet — rows marked "Counted: Yes".',
  );
}

// --- Workouts ----------------------------------------------------------------

function workoutsSheet(
  ws: ExcelJS.Worksheet,
  data: ExportData,
  unit: string,
  range: (key: Parameters<typeof setCol>[0]) => string,
) {
  header(ws, [
    "Date",
    "Workout #",
    "Workout",
    "Minutes",
    "Exercises",
    "Working sets",
    `Volume (${unit})`,
  ]);
  [12, 10, 30, 9, 10, 13, 13].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = "A1:G1";
  ws.getCell("G1").note = `Weight × reps over the working sets, in ${unit}.`;

  data.workouts.forEach((w, i) => {
    const r = i + 2;
    const row = ws.getRow(r);
    cell(row.getCell(1), excelDate(w.date), DATE_FMT);
    cell(row.getCell(2), w.number);
    cell(row.getCell(3), w.name);
    cell(row.getCell(4), w.minutes);
    cell(row.getCell(5), w.exercises);
    cell(row.getCell(6), {
      formula: `COUNTIFS(${range("workout")},B${r},${range("counted")},"Yes")`,
      result: w.countedSets,
    });
    cell(
      row.getCell(7),
      {
        formula: `SUMPRODUCT((${range("workout")}=B${r})*(${range("counted")}="Yes")*${range("weight")}*${range("reps")})`,
        result: w.volume,
      },
      "#,##0",
    );
  });
}

// --- Sets --------------------------------------------------------------------

function setsSheet(ws: ExcelJS.Worksheet, data: ExportData, unit: string) {
  header(
    ws,
    SET_COLUMNS.map((c) => (c.key === "weight" ? `Weight (${unit})` : c.header)),
  );
  SET_COLUMNS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = `A1:${colLetter(SET_COLUMNS.length)}1`;
  ws.getCell(`${setCol("counted")}1`).note =
    "Yes when the set counts toward sets per muscle group: not a warm-up, and reps or a hold time logged.";

  data.sets.forEach((s, i) => {
    const row = ws.getRow(i + 2);
    SET_COLUMNS.forEach((c, j) => {
      const target = row.getCell(j + 1);
      switch (c.key) {
        case "date":
        case "week":
          return cell(target, excelDate(s[c.key]), DATE_FMT);
        case "toFailure":
          return cell(target, s.toFailure ? "Yes" : "");
        case "counted":
          return cell(target, s.counted ? "Yes" : "No");
        default:
          return cell(target, s[c.key]);
      }
    });
  });
}

// --- helpers -----------------------------------------------------------------

function header(ws: ExcelJS.Worksheet, labels: string[]) {
  const row = ws.getRow(1);
  labels.forEach((label, i) => {
    const c = row.getCell(i + 1);
    c.value = label;
    c.font = { ...FONT, bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = { bottom: { style: "thin", color: { argb: HEADER_LINE } } };
    c.alignment = { vertical: "middle" };
  });
  row.height = 18;
}

function cell(target: ExcelJS.Cell, value: ExcelJS.CellValue, numFmt?: string) {
  target.value = value;
  target.font = { ...FONT };
  if (numFmt) target.numFmt = numFmt;
}

function note(ws: ExcelJS.Worksheet, r: number, text: string) {
  const c = ws.getRow(r).getCell(1);
  c.value = text;
  c.font = { ...FONT, italic: true, color: { argb: NOTE_COLOR } };
}

/** A `yyyy-mm-dd` key as a whole-day Excel date (UTC midnight → no time part). */
function excelDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 1 → "A", 27 → "AA". */
export function colLetter(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
