"use server";

import { signIn, signOut } from "@/auth";

export async function signInWith(provider: "github" | "google") {
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
