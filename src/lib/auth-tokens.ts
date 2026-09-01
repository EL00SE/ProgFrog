import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { AuthTokenType } from "@/generated/prisma/client";

const TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24h
  PASSWORD_RESET: 60 * 60 * 1000, // 1h
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/**
 * Mint a single-use token for `userId`. Only the hash is stored; the returned
 * raw value goes in the email link. Any earlier token of the same type for that
 * user is invalidated.
 */
export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type } }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256(raw),
        expires: new Date(Date.now() + TTL_MS[type]),
      },
    }),
  ]);
  return raw;
}

/**
 * Validate and burn a token. Returns the `userId` on success, `null` if the
 * token is unknown, expired, or the wrong type.
 */
export async function consumeAuthToken(
  raw: string,
  type: AuthTokenType,
): Promise<string | null> {
  if (!raw) return null;
  const hash = sha256(raw);
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hash } });
  if (!row || row.type !== type) return null;

  // constant-time compare of the stored hash against the recomputed one
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await prisma.authToken.delete({ where: { id: row.id } }).catch(() => {});
  if (row.expires.getTime() < Date.now()) return null;
  return row.userId;
}
