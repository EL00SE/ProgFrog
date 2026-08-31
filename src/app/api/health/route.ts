import { prisma } from "@/lib/prisma";

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
    out.userCount = await prisma.user.count();
  } catch (e) {
    out.db = {
      connected: false,
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return Response.json(out, { status: 200 });
}

/** Reveal enough of DATABASE_URL to debug without leaking the password. */
function envShape(url: string | undefined) {
  if (!url) return { set: false };
  const quoted = /^["']|["']$/.test(url.trim());
  const host = url.match(/@([^/?]+)/)?.[1] ?? null;
  const params = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  return {
    set: true,
    length: url.length,
    startsWith: url.slice(0, 11),
    wrappedInQuotes: quoted,
    host,
    params,
  };
}
