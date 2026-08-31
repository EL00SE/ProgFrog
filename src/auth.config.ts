import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { name as pkgName } from "../package.json";

/**
 * Edge-safe Auth.js config: no database adapter, no Node-only imports.
 * Shared by the full server instance (`auth.ts`) and the proxy (`proxy.ts`).
 */

// The session cookie name is namespaced per project: localhost apps share one
// cookie jar across ports, so a shared name makes a sibling project's stale
// token fail to decrypt ("no matching decryption secret" JWTSessionError).
// Defaults to the package.json name (which you rename per project anyway);
// AUTH_COOKIE_PREFIX overrides it if you need an explicit value.
const cookiePrefix =
  process.env.AUTH_COOKIE_PREFIX?.trim() ||
  pkgName.replace(/[^a-z0-9_-]/gi, "") ||
  "authjs";
const useSecureCookies =
  process.env.AUTH_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";

export default {
  cookies: {
    sessionToken: {
      name: `${useSecureCookies ? "__Secure-" : ""}${cookiePrefix}.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  // `allowDangerousEmailAccountLinking` lets one person use GitHub *or* Google
  // for the same email and land on a single account. It's safe here because both
  // providers verify email ownership; only enable it for providers you trust.
  providers: [
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    /** Runs in the proxy on every matched request. */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (isOnDashboard) return isLoggedIn;

      // Bounce signed-in users away from the sign-in page.
      if (isLoggedIn && nextUrl.pathname === "/sign-in") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
