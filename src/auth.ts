import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions keep the proxy edge-compatible and avoid a DB read per request.
  // The adapter still persists users/accounts on OAuth sign-in.
  session: { strategy: "jwt" },
  ...authConfig,
});
