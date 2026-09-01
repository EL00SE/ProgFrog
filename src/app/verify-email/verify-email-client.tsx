"use client";

import { useActionState } from "react";

import { resendVerification, verifyEmail } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Token present → one button to confirm; on failure, fall through to resend. */
export function ConfirmVerification({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmail, {});

  return (
    <div className="grid gap-4">
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton className="w-full">Confirm my email</SubmitButton>
      </form>
      {state.error ? (
        <div className="grid gap-3">
          <FormMessage state={state} />
          <p className="text-muted-foreground text-center text-sm">
            Enter your email for a fresh link:
          </p>
          <ResendVerificationForm />
        </div>
      ) : null}
    </div>
  );
}

export function ResendVerificationForm() {
  const [state, action] = useActionState(resendVerification, {});

  if (state.message) return <FormMessage state={state} />;

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
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Send a new link</SubmitButton>
    </form>
  );
}
