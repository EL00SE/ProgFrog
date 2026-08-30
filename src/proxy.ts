import NextAuth from "next-auth";

import authConfig from "@/auth.config";

// Next.js 16 renamed Middleware to "Proxy". This runs the Auth.js `authorized`
// callback (see auth.config.ts) on every matched route for optimistic redirects.
// Real authorization still happens in Server Components / Actions via `auth()`.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
