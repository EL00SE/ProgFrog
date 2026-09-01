"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";

import { auth, signIn, signOut } from "@/auth";
import { env } from "@/env";
import { consumeAuthToken, issueAuthToken } from "@/lib/auth-tokens";
import { accountExistsEmail, passwordResetEmail, verificationEmail } from "@/lib/email";
import {
  hashPassword,
  isAcceptablePassword,
  passwordSchemaMessage,
} from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type AuthFormState = { error?: string; message?: string };

type OAuthProvider = "google" | "facebook" | "twitter";

export async function signInWith(provider: OAuthProvider) {
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// --- email + password ------------------------------------------------------

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");

function verifyUrl(token: string) {
  return `${env.APP_URL}/verify-email?token=${token}`;
}
function resetUrl(token: string) {
  return `${env.APP_URL}/reset-password?token=${token}`;
}
const signInUrl = () => `${env.APP_URL}/sign-in`;

/**
 * Create an email + password account and send a verification link. Never
 * confirms whether an address is already registered — a duplicate gets an
 * "you already have an account" email and the same generic response.
 */
export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const limit = rateLimit(`signup:${await clientIp()}`, {
    windowMs: 60 * 60_000,
    max: 10,
  });
  if (!limit.ok) return { error: "Too many attempts. Try again later." };

  const parsed = z
    .object({
      name: z.string().trim().max(80).optional(),
      email: emailSchema,
      password: z.string(),
    })
    .safeParse({
      name: formData.get("name") || undefined,
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { name, email, password } = parsed.data;
  if (!isAcceptablePassword(password)) return { error: passwordSchemaMessage };

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (existing) {
    await accountExistsEmail(email, signInUrl()).catch(() => {});
  } else {
    const user = await prisma.user.create({
      data: { name: name || null, email, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION");
    await verificationEmail(email, verifyUrl(token)).catch(() => {});
  }

  return {
    message:
      "Check your email for a link to verify your address, then sign in. It may take a minute to arrive.",
  };
}

export async function signInWithCredentials(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await clientIp();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const limit = rateLimit(`signin:${ip}:${email}`, {
    windowMs: 15 * 60_000,
    max: 10,
  });
  if (!limit.ok) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }

  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // A successful sign-in throws a NEXT_REDIRECT — anything that isn't an
    // AuthError must propagate.
    if (!(error instanceof AuthError)) throw error;
    const code = (error as { code?: string }).code;
    if (code === "unverified") {
      return {
        error:
          "Verify your email first — check your inbox for the link, or request a new one below.",
      };
    }
    return { error: "That email and password don't match." };
  }
  return {};
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const limit = rateLimit(`reset:${await clientIp()}`, {
    windowMs: 60 * 60_000,
    max: 10,
  });
  if (!limit.ok) return { error: "Too many requests. Try again later." };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (parsed.success) {
    // Also covers OAuth users setting a password for the first time.
    const user = await prisma.user.findUnique({
      where: { email: parsed.data },
      select: { id: true },
    });
    if (user) {
      const token = await issueAuthToken(user.id, "PASSWORD_RESET");
      await passwordResetEmail(parsed.data, resetUrl(token)).catch(() => {});
    }
  }

  return {
    message: "If that email is registered, a link is on its way. It may take a minute.",
  };
}

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!isAcceptablePassword(password)) return { error: passwordSchemaMessage };

  const userId = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!userId) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      // A working reset link proves control of the inbox.
      emailVerified: new Date(),
    },
  });
  // Invalidate any other outstanding tokens for this account.
  await prisma.authToken.deleteMany({ where: { userId } });

  redirect("/sign-in?reset=1");
}

export async function resendVerification(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const limit = rateLimit(`resend:${await clientIp()}`, {
    windowMs: 60 * 60_000,
    max: 5,
  });
  if (!limit.ok) return { error: "Too many requests. Try again later." };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (parsed.success) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data },
      select: { id: true, emailVerified: true, passwordHash: true },
    });
    if (user?.passwordHash && !user.emailVerified) {
      const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION");
      await verificationEmail(parsed.data, verifyUrl(token)).catch(() => {});
    }
  }
  return { message: "If that account needs verifying, a fresh link is on its way." };
}

/** Consume a verification token (called from the /verify-email page). */
export async function verifyEmailToken(
  token: string,
): Promise<{ ok: true } | { ok: false }> {
  const userId = await consumeAuthToken(token, "EMAIL_VERIFICATION");
  if (!userId) return { ok: false };
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
  return { ok: true };
}

/** Whether the current session belongs to a password account (for Settings UI). */
export async function currentUserHasPassword(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  return !!user?.passwordHash;
}
