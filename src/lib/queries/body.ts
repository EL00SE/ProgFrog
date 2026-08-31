import "server-only";

import { prisma } from "@/lib/prisma";
import { convertWeight, localDateKey, type WeightUnit } from "@/lib/training";

export type BodyPoint = {
  id: string;
  date: string;
  weight: number;
  notes: string | null;
};

export type BodyData = {
  points: BodyPoint[];
  latest: BodyPoint | null;
  /** change from the first recorded entry to the latest, in `displayUnit` */
  change: number | null;
};

/** The user's body-weight history, converted to their preferred unit. */
export async function getBodyData(
  userId: string,
  displayUnit: WeightUnit,
): Promise<BodyData> {
  const rows = await prisma.bodyEntry.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  const points: BodyPoint[] = rows.map((r) => ({
    id: r.id,
    date: localDateKey(r.date),
    weight: round(convertWeight(r.weightKg, "KG", displayUnit)),
    notes: r.notes,
  }));

  const latest = points.at(-1) ?? null;
  const change =
    points.length > 1 && latest ? round(latest.weight - points[0].weight) : null;

  return { points, latest, change };
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
