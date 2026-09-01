import "server-only";

import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Minimum bar for a new password. Deliberately lenient (length only) — length is
 * what actually matters, and a stricter policy pushes people toward `Passw0rd!`.
 */
export const passwordSchemaMessage =
  "Use at least 8 characters — a short phrase works well.";

export function isAcceptablePassword(pw: string): boolean {
  return pw.length >= 8 && pw.length <= 200;
}
