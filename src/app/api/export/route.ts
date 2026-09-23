import { getCurrentUser, getSession } from "@/lib/dal";
import { getFinishedWorkouts } from "@/lib/queries/workouts";
import { buildExport } from "@/lib/export/build";
import { writeWorkbook } from "@/lib/export/workbook";
import { localDateKey } from "@/lib/training";

export const dynamic = "force-dynamic";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The signed-in user's training history as an Excel workbook (weekly sets per
 * muscle group, workouts, every set). Only their own finished workouts.
 */
export async function GET() {
  // A plain 401 rather than getCurrentUser()'s redirect: the export button
  // fetches this, and would otherwise receive the sign-in page as the "file".
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const workouts = await getFinishedWorkouts(user.id);
  const file = await writeWorkbook(buildExport(workouts, user.weightUnit));

  return new Response(file, {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="progfrog-${localDateKey(new Date())}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
