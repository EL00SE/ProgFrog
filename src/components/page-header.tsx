import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page top: title + optional description on the left, optional actions
 * (buttons) on the right. Wraps cleanly on narrow screens.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-3",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-balance sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
