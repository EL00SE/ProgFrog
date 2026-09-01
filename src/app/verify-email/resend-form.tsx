"use client";

import { useActionState } from "react";

import { resendVerification } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResendVerificationForm() {
  const [state, action] = useActionState(resendVerification, {});

  if (state.message) return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-3 text-left">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Send a new link</SubmitButton>
    </form>
  );
}
