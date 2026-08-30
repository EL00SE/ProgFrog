import Link from "next/link";
import { ArrowRight, Database, Lock, Palette, TestTube } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";

const features = [
  {
    icon: Lock,
    title: "Auth.js v5",
    body: "GitHub + Google OAuth, JWT sessions, protected routes.",
  },
  {
    icon: Database,
    title: "Prisma 7 + Postgres",
    body: "Typed queries, migrations, seed script, Docker DB.",
  },
  {
    icon: Palette,
    title: "Tailwind v4 + shadcn/ui",
    body: "Owned components, dark mode, design tokens.",
  },
  {
    icon: TestTube,
    title: "Vitest + Playwright",
    body: "Unit and end-to-end tests wired into CI.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-20">
        <section className="flex flex-col items-start gap-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your app base, ready to build on.
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg">
            A full-stack Next.js starter with authentication, a database, a component
            library, and tests already wired together. Clone it and start shipping.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/dashboard">
                Go to dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="https://nextjs.org/docs" target="_blank" rel="noopener noreferrer">
                Next.js docs
              </a>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">{body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto max-w-5xl px-4 py-6 text-sm">
          Built with Next.js, Prisma, Auth.js, Tailwind, and shadcn/ui.
        </div>
      </footer>
    </>
  );
}
