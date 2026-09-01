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
import { CredentialsForm } from "./credentials-form";
import { SignInButtons } from "./sign-in-buttons";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { reset } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <ClearPageCache />
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">Sign in to ProgFrog</CardTitle>
          <CardDescription>Log your workouts and track your progress.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {reset ? (
            <p
              className="border-primary/30 bg-primary/5 text-primary rounded-lg border p-2.5 text-center text-sm"
              role="status"
            >
              Password updated — sign in with your new one.
            </p>
          ) : null}

          <CredentialsForm />

          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <SignInButtons />

          <p className="text-muted-foreground text-center text-sm">
            New here?{" "}
            <Link href="/sign-up" className="text-foreground font-medium underline">
              Create an account
            </Link>
          </p>
          <p className="text-muted-foreground text-center text-xs">
            Didn&rsquo;t get a verification email?{" "}
            <Link href="/verify-email" className="underline">
              Resend it
            </Link>
          </p>
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
