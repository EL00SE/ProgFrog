import type { NextConfig } from "next";

// Validate env vars at build time (throws early if something is missing).
import "./src/env";

/**
 * Response security headers, applied to every route.
 *
 * The CSP allows `'unsafe-inline'` for scripts and styles because the Next.js
 * App Router injects inline hydration/bootstrap scripts and styled-jsx style
 * tags without a nonce. It still blocks loading scripts, styles, frames and
 * connections from other origins, and blocks this app from being framed. There
 * are no `dangerouslySetInnerHTML` sinks that touch user input, so inline
 * script/style is a limited concession.
 */
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // Dev needs 'unsafe-eval' (React Refresh / source maps).
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // OAuth provider avatars (Google/Facebook) + inline data URIs.
  "img-src 'self' data: https:",
  "font-src 'self'",
  // Dev needs the HMR websocket.
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS only in prod — pinning localhost to https breaks local dev.
  ...(dev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
