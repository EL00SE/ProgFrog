"use client";

import { useFormStatus } from "react-dom";

import { signInWith } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon, XIcon } from "@/components/brand-icons";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {children}
    </Button>
  );
}

export function SignInButtons() {
  return (
    <div className="grid gap-3">
      <form action={signInWith.bind(null, "google")}>
        <SubmitButton>
          <GoogleIcon className="mr-2 h-4 w-4" />
          Continue with Google
        </SubmitButton>
      </form>
      <form action={signInWith.bind(null, "facebook")}>
        <SubmitButton>
          <FacebookIcon className="mr-2 h-4 w-4" />
          Continue with Facebook
        </SubmitButton>
      </form>
      <form action={signInWith.bind(null, "twitter")}>
        <SubmitButton>
          <XIcon className="mr-2 h-3.5 w-3.5" />
          Continue with X
        </SubmitButton>
      </form>
    </div>
  );
}
