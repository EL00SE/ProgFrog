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
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <FrogMark className="mb-1 size-10" />
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>Then sign in with it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {typeof token === "string" && token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-destructive text-sm" role="alert">
              This link is missing its token. Request a new reset email.
            </p>
          )}
          <p className="text-muted-foreground text-center text-sm">
            <Link
              href="/forgot-password"
              className="text-foreground font-medium underline"
            >
              Request a new link
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
