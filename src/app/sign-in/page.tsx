import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FrogMark } from "@/components/logo";
import { ClearPageCache } from "@/components/pwa/clear-page-cache";
import { SignInButtons } from "./sign-in-buttons";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <ClearPageCache />
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">Sign in to ProgFrog</CardTitle>
          <CardDescription>
            Continue with a provider to start logging your workouts.
          </CardDescription>
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
