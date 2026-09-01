import "server-only";

import { env } from "@/env";

export type OAuthProviderId = "google" | "facebook" | "twitter";

/** Providers whose ID + SECRET are both set — the only ones worth showing. */
export function enabledOAuthProviders(): OAuthProviderId[] {
  const out: OAuthProviderId[] = [];
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) out.push("google");
  if (env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET) out.push("facebook");
  if (env.AUTH_TWITTER_ID && env.AUTH_TWITTER_SECRET) out.push("twitter");
  return out;
}
