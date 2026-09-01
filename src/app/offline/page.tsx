import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

import { FrogMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
        <WifiOff className="size-6" />
      </span>
      <h1 className="text-xl font-bold tracking-tight">You&rsquo;re offline</h1>
      <p className="text-muted-foreground text-sm text-pretty">
        ProgFrog needs a connection for this page. Pages you&rsquo;ve already opened still
        work — reconnect to load anything new or to save a workout.
      </p>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <FrogMark className="size-3.5" />
        Back online? Refresh to pick up where you left off.
      </p>
    </main>
  );
}
