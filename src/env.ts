import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment variables. Importing this module throws at startup if
 * anything required is missing or malformed, instead of failing deep in a request.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    // `openssl rand -base64 32` — used by Auth.js to sign tokens.
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
    // Absolute origin of the app — used to build links in outgoing emails.
    APP_URL: z.string().url().default("http://localhost:3001"),
    // OAuth providers are optional so the app boots without them; sign-in with a
    // given provider only works once its pair is set.
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_FACEBOOK_ID: z.string().optional(),
    AUTH_FACEBOOK_SECRET: z.string().optional(),
    AUTH_TWITTER_ID: z.string().optional(),
    AUTH_TWITTER_SECRET: z.string().optional(),
    // Transactional email (verification + password reset). Optional — when unset,
    // those flows log the link to the server console instead of sending it.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("ProgFrog <onboarding@resend.dev>"),
    // Optional — the in-app training assistant is disabled until this is set.
    ANTHROPIC_API_KEY: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_URL: process.env.APP_URL,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_FACEBOOK_ID: process.env.AUTH_FACEBOOK_ID,
    AUTH_FACEBOOK_SECRET: process.env.AUTH_FACEBOOK_SECRET,
    AUTH_TWITTER_ID: process.env.AUTH_TWITTER_ID,
    AUTH_TWITTER_SECRET: process.env.AUTH_TWITTER_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
