"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { signInWith } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon, XIcon } from "@/components/brand-icons";

type Provider = "google" | "facebook" | "twitter";

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  { id: "google", label: "Google", icon: <GoogleIcon className="size-4" /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon className="size-4" /> },
  { id: "twitter", label: "X", icon: <XIcon className="size-3.5" /> },
];

/**
 * Provider sign-in buttons. Each is its own form posting to `signInWith`, which
 * throws a redirect to the provider — so we show a spinner and lock every
 * button the moment one is tapped (the page is about to navigate away; a
 * double-tap or an impatient second choice would be wasted).
 */
export function OAuthButtons({ verb = "Continue" }: { verb?: "Continue" | "Sign up" }) {
  const [busy, setBusy] = React.useState<Provider | null>(null);

  return (
    <div className="grid gap-3">
      {PROVIDERS.map(({ id, label, icon }) => (
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
              <span className="mr-2 flex size-4 items-center justify-center">{icon}</span>
            )}
            {verb} with {label}
          </Button>
        </form>
      ))}
    </div>
  );
}
