"use client";

import { useActionState } from "react";

import { resetPassword } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, {});

  return (
    <form action={action} className="grid gap-3 text-left">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="h-10"
          required
        />
        <p className="text-muted-foreground text-xs">At least 8 characters.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Set new password</SubmitButton>
    </form>
  );
}
