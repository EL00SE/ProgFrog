const MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with a different sign-in method. Use that one, or your password.",
  AccessDenied: "Sign-in was cancelled or not permitted.",
  Configuration:
    "That sign-in method isn't set up yet. Try another, or use email and password.",
  Verification: "That link has expired. Request a new one.",
  CredentialsSignin: "That email and password don't match.",
};

/** Renders the friendly version of an Auth.js `?error=` code. Nothing if absent. */
export function AuthError({ code }: { code?: string }) {
  if (!code) return null;
  const message = MESSAGES[code] ?? "Something went wrong signing in. Please try again.";
  return (
    <p
      className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-2.5 text-center text-sm"
      role="alert"
    >
      {message}
    </p>
  );
}
