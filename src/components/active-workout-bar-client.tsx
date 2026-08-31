"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function ActiveWorkoutBarShell({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Don't nag when you're already on that workout.
  if (pathname === href) return null;

  return <div className="border-b">{children}</div>;
}
