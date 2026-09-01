"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signInWithCredentials } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CredentialsForm() {
  const [state, action] = useActionState(signInWithCredentials, {});

  return (
    <form action={action} className="grid gap-3 text-left">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-10"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-10"
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </form>
  );
}
