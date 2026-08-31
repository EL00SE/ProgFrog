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
    // OAuth providers are optional so the app boots without them; sign-in with a
    // given provider only works once its pair is set.
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
