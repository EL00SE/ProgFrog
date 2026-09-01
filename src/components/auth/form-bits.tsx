"use client";

import { useFormStatus } from "react-dom";

import type { AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? "Working…" : children}
    </Button>
  );
}

/** Renders the error or success line returned by an auth server action. */
export function FormMessage({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p className="text-primary text-sm" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}
