import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MetadataRoute } from "next";

const ICON_FILES = ["icon-192.png", "icon-512.png", "icon-maskable-512.png"];

/**
 * A short digest of the icon bytes, appended to their URLs in the manifest.
 * The files have stable names, so without this an installed PWA (Chrome
 * desktop, Android) keeps the icon it captured at install and never notices a
 * redesign. Changing the query makes the browser re-fetch on its next manifest
 * check. `next build` runs from the repo root, so `public/` is readable here.
 */
const iconRev = (() => {
  try {
    const h = createHash("sha1");
    for (const f of ICON_FILES) {
      h.update(readFileSync(join(process.cwd(), "public", f)));
    }
    return h.digest("hex").slice(0, 10);
  } catch {
    return "0";
  }
})();

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProgFrog",
    short_name: "ProgFrog",
    description: "Track your workouts, sets, and progress.",
    // Chrome / Windows key an installed PWA (and its cached icon, its Start-Menu
    // entry, its IconCache.db row) off `id`. After the rebrand, existing installs
    // kept the old icon through uninstall+reinstall because the identity — and so
    // every cache — was unchanged. Bumping `id` makes it a fresh app: new folder,
    // new icon fetch, no collision. Bump again (v3, …) if this ever recurs.
    id: "/?v=2",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // No orientation lock — the layout is responsive, and locking it on an
    // installed PWA (Android honors this) fails WCAG 1.3.4 for anyone who
    // mounts their phone in landscape or reads in landscape by preference.
    orientation: "any",
    background_color: "#14110c",
    theme_color: "#14110c",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: `/icon-192.png?v=${iconRev}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-512.png?v=${iconRev}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-maskable-512.png?v=${iconRev}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Start a workout",
        short_name: "Workout",
        url: "/dashboard/workouts/new",
      },
      { name: "Progress", short_name: "Progress", url: "/dashboard/progress" },
    ],
  };
}
