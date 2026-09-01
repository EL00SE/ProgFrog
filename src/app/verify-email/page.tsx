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
import { ConfirmVerification, ResendVerificationForm } from "./verify-email-client";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const hasToken = typeof token === "string" && token.length > 0;

  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">
            {hasToken ? "Almost there" : "Verify your email"}
          </CardTitle>
          <CardDescription>
            {hasToken
              ? "Confirm the address you signed up with."
              : "Enter your email and we'll send a new verification link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {hasToken ? <ConfirmVerification token={token} /> : <ResendVerificationForm />}
          <p className="text-muted-foreground text-center text-sm">
            <Link href="/sign-in" className="text-foreground font-medium underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
