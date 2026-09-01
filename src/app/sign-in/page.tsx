import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { enabledOAuthProviders } from "@/lib/oauth";
import { FrogMark } from "@/components/logo";
import { AuthError } from "@/components/auth/auth-error";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { ClearPageCache } from "@/components/pwa/clear-page-cache";
import { CredentialsForm } from "./credentials-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const providers = enabledOAuthProviders();
  const error = typeof params.error === "string" ? params.error : undefined;
  const notice = params.verified
    ? "Email verified — sign in to get started."
    : params.reset
      ? "Password updated — sign in with your new one."
      : null;

  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-16">
      <ClearPageCache />
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">Sign in to ProgFrog</CardTitle>
          <CardDescription>Log your workouts and track your progress.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <AuthError code={error} />
          {notice ? (
            <p
              className="border-primary/30 bg-primary/5 text-primary rounded-lg border p-2.5 text-center text-sm"
              role="status"
            >
              {notice}
            </p>
          ) : null}

          <CredentialsForm />

          {providers.length > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs">or</span>
                <span className="bg-border h-px flex-1" />
              </div>
              <OAuthButtons providers={providers} />
            </>
          ) : null}

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
