import type { Metadata } from "next";
import Link from "next/link";

import { verifyEmailToken } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FrogMark } from "@/components/logo";
import { ResendVerificationForm } from "./resend-form";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const hasToken = typeof token === "string" && token.length > 0;
  const result = hasToken ? await verifyEmailToken(token) : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">
            {result?.ok
              ? "Email verified"
              : hasToken
                ? "Link expired"
                : "Verify your email"}
          </CardTitle>
          <CardDescription>
            {result?.ok
              ? "Your account is active — you can sign in now."
              : hasToken
                ? "That link is invalid or already used. Enter your email for a fresh one."
                : "Enter your email and we'll send a new verification link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {result?.ok ? (
            <Button asChild className="w-full">
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          ) : (
            <>
              <ResendVerificationForm />
              <p className="text-muted-foreground text-center text-sm">
                <Link href="/sign-in" className="text-foreground font-medium underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
