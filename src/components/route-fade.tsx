"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Gently fades page content in when you move between tabs. Keyed on the
 * pathname so query-only changes (e.g. a filter) don't re-trigger it.
 */
export function RouteFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      {children}
    </div>
  );
}
