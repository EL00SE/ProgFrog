"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/lib/actions/auth";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";

/**
 * Set or change the account password. Rather than an in-page form (which would
 * need the current password / re-auth), this just emails the standard reset
 * link to the address on file.
 */
export function PasswordCard({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const [state, action] = useActionState(requestPasswordReset, {});

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="email" value={email} />
      <FormMessage state={state} />
      <SubmitButton className="w-fit">
        {hasPassword ? "Email me a reset link" : "Email me a link to set a password"}
      </SubmitButton>
    </form>
  );
}
