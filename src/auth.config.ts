import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config: no database adapter, no Node-only imports.
 * Shared by the full server instance (`auth.ts`) and the proxy (`proxy.ts`).
 */
export default {
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
