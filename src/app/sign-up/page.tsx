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
import { AuthError } from "@/components/auth/auth-error";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Start with a provider, or an email and password.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <AuthError code={error} />

          <OAuthButtons verb="Sign up" />

          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or with email</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <SignUpForm />

          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-foreground font-medium underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
