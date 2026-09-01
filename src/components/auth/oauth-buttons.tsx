"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { signInWith } from "@/lib/actions/auth";
import type { OAuthProviderId } from "@/lib/oauth";
import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon, XIcon } from "@/components/brand-icons";

const META: Record<OAuthProviderId, { label: string; icon: React.ReactNode }> = {
  google: { label: "Google", icon: <GoogleIcon className="size-4" /> },
  facebook: { label: "Facebook", icon: <FacebookIcon className="size-4" /> },
  twitter: { label: "X", icon: <XIcon className="size-3.5" /> },
};

/**
 * Buttons for the providers that are actually configured (`providers` prop).
 * Each is its own form posting to `signInWith`, which throws a redirect to the
 * provider — so we spin and lock every button the moment one is tapped (the
 * page is about to navigate away).
 */
export function OAuthButtons({
  providers,
  verb = "Continue",
}: {
  providers: OAuthProviderId[];
  verb?: "Continue" | "Sign up";
}) {
  const [busy, setBusy] = React.useState<OAuthProviderId | null>(null);

  if (providers.length === 0) return null;

  return (
    <div className="grid gap-3">
      {providers.map((id) => (
        <form key={id} action={signInWith.bind(null, id)} onSubmit={() => setBusy(id)}>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={busy !== null}
          >
            {busy === id ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <span className="mr-2 flex size-4 items-center justify-center">
                {META[id].icon}
              </span>
            )}
            {verb} with {META[id].label}
          </Button>
        </form>
      ))}
    </div>
  );
}
