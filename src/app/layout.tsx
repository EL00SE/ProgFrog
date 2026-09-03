import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// iOS launch screens. Portrait CSS points × dpr — keep in sync with
// scripts/gen-splash.mts, which renders the matching PNGs into public/splash.
const IOS_SPLASH: [number, number, number][] = [
  [375, 667, 2],
  [414, 736, 3],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
];

export const metadata: Metadata = {
  title: {
    default: "ProgFrog",
    template: "%s · ProgFrog",
  },
  description: "Track your workouts, sets, and progress.",
  applicationName: "ProgFrog",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ProgFrog",
    statusBarStyle: "black-translucent",
    startupImage: IOS_SPLASH.map(([w, h, r]) => ({
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe2" },
    { media: "(prefers-color-scheme: dark)", color: "#14110c" },
  ],
  // Let the app draw into the notch / home-indicator area once installed.
  viewportFit: "cover",
  // Shrink the layout viewport when the on-screen keyboard opens, so
  // bottom-anchored sheets (the exercise picker) stay above it. Chrome/Android
  // honours this; iOS Safari ignores it and the picker handles it in JS.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
