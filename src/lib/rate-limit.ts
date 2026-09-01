import "server-only";

import { headers } from "next/headers";

/**
 * Best-effort in-memory rate limiting. State lives in module scope, so it resets
 * on deploy and isn't shared across serverless instances — enough to blunt
 * credential-stuffing and email-spam, not a hard quota. Swap for a Redis/KV
 * store if this ever needs to be authoritative.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < opts.windowMs);
  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > 10_000) buckets.clear(); // crude cap

  if (hits.length > opts.max) {
    return { ok: false, retryAfterMs: opts.windowMs - (now - hits[0]) };
  }
  return { ok: true, retryAfterMs: 0 };
}

/** The client IP, from the proxy headers. Falls back to a constant. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  );
}
