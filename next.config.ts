import type { NextConfig } from "next";

// Validate env vars at build time (throws early if something is missing).
import "./src/env";

const nextConfig: NextConfig = {
  // Emit a minimal server bundle for the Docker image. Vercel runs its own
  // build pipeline and the standalone trace output trips it up (a missing
  // next-server.js.nft.json), so leave it off there.
  output: process.env.VERCEL ? undefined : "standalone",
  // Prisma's generated client ships files that shouldn't be bundled.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
  // Hide the on-screen dev indicator (dev-only; never rendered in production).
  devIndicators: false,
  experimental: {
    // Keep visited pages in the client router cache briefly so tab-to-tab
    // navigation (and swipes) render instantly instead of refetching. Server
    // actions still call revalidatePath() to bust it after a mutation.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
