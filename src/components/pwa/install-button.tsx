"use client";

import * as React from "react";
import { Check, Download, Share } from "lucide-react";

import { useInstallPrompt } from "@/lib/use-install-prompt";
import { Button } from "@/components/ui/button";

export function InstallButton() {
  const { canPrompt, isStandalone, promptInstall } = useInstallPrompt();
  const [platform, setPlatform] = React.useState<"ios" | "other" | null>(null);

  React.useEffect(() => {
    const detect = () =>
      setPlatform(/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "other");
    detect();
  }, []);

  if (isStandalone) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Check className="size-4 text-emerald-500" />
        Installed on this device.
      </p>
    );
  }

  if (canPrompt) {
    return (
      <Button onClick={() => promptInstall()}>
        <Download className="size-4" /> Install ProgFrog
      </Button>
    );
  }

  if (platform === "ios") {
    return (
      <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
        <Share className="mt-0.5 size-4 shrink-0" />
        <span>
          In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.
        </span>
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm text-pretty">
      Look for the <b>install icon</b> at the right end of the address bar (Chrome and
      Edge), or open the browser menu and choose <b>Install ProgFrog</b>. The option can
      take a few seconds to appear after the page loads.
    </p>
  );
}
