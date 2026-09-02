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
  },
};

export const viewport: Viewport = {
  themeColor: "#0b3b2e",
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
