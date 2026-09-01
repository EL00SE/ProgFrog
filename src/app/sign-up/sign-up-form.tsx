"use client";

import { useActionState } from "react";

import { signUp } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, {});

  // On success the action returns a `message` — show it and hide the form.
  if (state.message) {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="grid gap-3 text-left">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name (optional)</Label>
        <Input id="name" name="name" autoComplete="name" maxLength={80} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-muted-foreground text-xs">
          At least 8 characters — a short phrase works well.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Create account</SubmitButton>
    </form>
  );
}
