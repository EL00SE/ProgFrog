import type { NextConfig } from "next";

// Validate env vars at build time (throws early if something is missing).
import "./src/env";

const nextConfig: NextConfig = {
  // Emit a minimal server bundle for the Docker image.
  output: "standalone",
  // Prisma's generated client ships files that shouldn't be bundled.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
  // Hide the on-screen dev indicator (dev-only; never rendered in production).
  devIndicators: false,
};

export default nextConfig;
