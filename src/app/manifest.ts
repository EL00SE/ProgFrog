import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProgFrog",
    short_name: "ProgFrog",
    description: "Track your workouts, sets, and progress.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b3b2e",
    theme_color: "#0b3b2e",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
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
