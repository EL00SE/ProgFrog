import "dotenv/config";

import { defineConfig } from "prisma/config";

// Read the URL directly (not prisma's `env()` helper) so `prisma generate` still
// runs when DATABASE_URL is unset — e.g. `pnpm install` on a fresh clone before
// `.env` exists. Commands that actually touch the DB fail clearly if it's empty.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
