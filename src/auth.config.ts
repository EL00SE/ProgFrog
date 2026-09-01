import type { NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";

import { name as pkgName } from "../package.json";

/**
 * Edge-safe Auth.js config: no database adapter, no Node-only imports.
 * Shared by the full server instance (`auth.ts`) and the proxy (`proxy.ts`).
 * The Credentials (email + password) provider is added in `auth.ts` only —
 * bcrypt can't run on the edge.
 */

// The session cookie name is namespaced per project: localhost apps share one
// cookie jar across ports, so a shared name makes a sibling project's stale
// token fail to decrypt ("no matching decryption secret" JWTSessionError).
const cookiePrefix =
  process.env.AUTH_COOKIE_PREFIX?.trim() ||
  pkgName.replace(/[^a-z0-9_-]/gi, "") ||
  "authjs";
const useSecureCookies =
  process.env.AUTH_URL?.startsWith("https://") ?? process.env.NODE_ENV === "production";

// Signed-in users get bounced to the dashboard from these. `/reset-password`
// and `/verify-email` stay reachable — someone may follow an email link while
// already signed in on another account.
const PUBLIC_ONLY = new Set(["/sign-in", "/sign-up", "/forgot-password"]);

// Only wire up a provider when both halves of its key pair are present, so an
// unconfigured provider never shows a button that leads to a broken page.
const oauthProviders: NonNullable<NextAuthConfig["providers"]> = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(Google({ allowDangerousEmailAccountLinking: true }));
}
if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
  oauthProviders.push(Facebook({ allowDangerousEmailAccountLinking: true }));
}
if (process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET) {
  oauthProviders.push(Twitter);
}

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
  // `allowDangerousEmailAccountLinking` (set on the configured providers above)
  // lets one person use any of them for the same email and land on a single
  // account. Safe here because Google and Facebook both verify email ownership.
  // Twitter/X never returns an email, so there's nothing to link on.
  providers: oauthProviders,
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    /** Runs in the proxy on every matched request. */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (isOnDashboard) return isLoggedIn;

      // Bounce signed-in users away from the auth pages.
      if (isLoggedIn && PUBLIC_ONLY.has(nextUrl.pathname)) {
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
