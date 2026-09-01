"use client";

import * as React from "react";

/**
 * Tells the service worker to drop its cached authenticated pages. Mounted on
 * the sign-in page, which is where you land after signing out — so a shared
 * device doesn't keep an offline-readable copy of the previous user's data.
 * Renders nothing.
 */
export function ClearPageCache() {
  React.useEffect(() => {
    navigator.serviceWorker?.ready
      .then((reg) => reg.active?.postMessage("clear-pages"))
      .catch(() => {});
  }, []);

  return null;
}
