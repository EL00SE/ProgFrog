import * as React from "react";

/**
 * A single tab pane inside {@link TabPager}. Owns its own vertical scroll (the
 * strip locks the viewport height), and carries the page gutter + bottom room
 * for the fixed mobile tab bar.
 */
export function Pane({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto overscroll-y-contain">
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] sm:px-6 md:py-8 md:pb-10">
        {children}
      </div>
    </div>
  );
}
