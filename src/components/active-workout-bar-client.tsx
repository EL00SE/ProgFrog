"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

export function ActiveWorkoutBarShell({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Ask the service worker to stash this workout's page so "Resume" still opens
  // it after the connection drops — even if it was never loaded online.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!navigator.onLine) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => {
        if (!cancelled) reg.active?.postMessage({ type: "cache-page", url: href });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [href]);

  // Don't nag when you're already on that workout.
  if (pathname === href) return null;

  return <div className="border-b">{children}</div>;
}
