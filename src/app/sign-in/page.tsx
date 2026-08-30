import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInButtons } from "./sign-in-buttons";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in to app-base</CardTitle>
          <CardDescription>Use a provider below to continue.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SignInButtons />
          <p className="text-muted-foreground text-center text-xs">
            By continuing you agree to the{" "}
            <Link href="/" className="underline">
              terms
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
