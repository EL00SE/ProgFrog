"use client";

import { useFormStatus } from "react-dom";

import { signInWith } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";

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
      <form action={signInWith.bind(null, "github")}>
        <SubmitButton>
          <GitHubIcon className="mr-2 h-4 w-4" />
          Continue with GitHub
        </SubmitButton>
      </form>
      <form action={signInWith.bind(null, "google")}>
        <SubmitButton>
          <GoogleIcon className="mr-2 h-4 w-4" />
          Continue with Google
        </SubmitButton>
      </form>
    </div>
  );
}
