"use client";

import * as React from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { tick } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

/**
 * Downloads the training history as an Excel workbook (`/api/export`). On a
 * phone the file goes to the share sheet — Save to Files, open in Excel,
 * AirDrop — since a plain download is awkward there (and in an installed app);
 * on a computer it just downloads.
 */
export function ExportButton() {
  const [pending, setPending] = React.useState(false);

  async function run() {
    if (pending) return;
    tick();
    setPending(true);
    try {
      const res = await fetch("/api/export", { cache: "no-store" });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
        "progfrog.xlsx";
      const file = new File([blob], name, { type: blob.type });
      if (onPhone() && navigator.canShare?.({ files: [file] })) await share(file);
      else download(file);
    } catch {
      toast.error(
        navigator.onLine
          ? "Couldn't export — try again"
          : "You're offline — reconnect to export",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" pending={pending} onClick={run}>
      <FileSpreadsheet className="size-4" /> Export to Excel
    </Button>
  );
}

function onPhone() {
  return window.matchMedia("(pointer: coarse)").matches;
}

async function share(file: File) {
  try {
    await navigator.share({ files: [file] });
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return; // closed the sheet
    // Building the file took long enough that the tap no longer counts as the
    // user asking (Safari allows ~1s) — so offer one fresh tap to open it.
    toast.success("Your spreadsheet is ready", {
      duration: 15_000,
      action: {
        label: "Open",
        onClick: () =>
          void navigator.share({ files: [file] }).catch(() => download(file)),
      },
    });
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
