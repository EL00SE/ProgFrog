import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getActiveWorkout,
  getDashboardStats,
  getRecentWorkouts,
} from "@/lib/queries/workouts";

// Temporary deploy diagnostic — remove once the Vercel deploy is healthy.
export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {
    runtime: process.env.VERCEL_ENV ?? "local",
    node: process.version,
    env: {
      DATABASE_URL: envShape(process.env.DATABASE_URL),
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      AUTH_URL: process.env.AUTH_URL ?? null,
      AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID,
      AUTH_GITHUB_ID: !!process.env.AUTH_GITHUB_ID,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
  };

  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`select 1 as ok`;
    out.db = { connected: true, rows };
  } catch (e) {
    out.db = { connected: false, ...errShape(e) };
    return Response.json(out);
  }

  try {
    const session = await auth();
    out.auth = { ok: true, signedIn: !!session?.user, userId: session?.user?.id ?? null };
  } catch (e) {
    out.auth = { ok: false, ...errShape(e) };
  }

  // Reproduce exactly what /dashboard renders, per existing user.
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, weightUnit: true },
    });
    out.dashboardProbe = [];
    for (const u of users) {
      try {
        const [active, recent, stats] = await Promise.all([
          getActiveWorkout(u.id),
          getRecentWorkouts(u.id, 6),
          getDashboardStats(u.id, u.weightUnit),
        ]);
        (out.dashboardProbe as unknown[]).push({
          email: mask(u.email),
          ok: true,
          activeWorkout: !!active,
          recent: recent.length,
          lifetimeWorkouts: stats.lifetime.workouts,
        });
      } catch (e) {
        (out.dashboardProbe as unknown[]).push({
          email: mask(u.email),
          ok: false,
          ...errShape(e),
        });
      }
    }
  } catch (e) {
    out.dashboardProbe = { error: errShape(e) };
  }

  return Response.json(out);
}

function errShape(e: unknown) {
  return {
    name: e instanceof Error ? e.name : typeof e,
    message: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack?.split("\n").slice(0, 6) : undefined,
  };
}

function mask(email: string) {
  return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

/** Reveal enough of DATABASE_URL to debug without leaking the password. */
function envShape(url: string | undefined) {
  if (!url) return { set: false };
  return {
    set: true,
    length: url.length,
    startsWith: url.slice(0, 11),
    wrappedInQuotes: /^["']|["']$/.test(url.trim()),
    host: url.match(/@([^/?]+)/)?.[1] ?? null,
    params: url.includes("?") ? url.slice(url.indexOf("?")) : "",
  };
}
