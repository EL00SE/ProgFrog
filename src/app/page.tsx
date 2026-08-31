import Link from "next/link";
import { Dumbbell, ListChecks, Plus, TrendingUp } from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FrogMark } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";

const features = [
  {
    icon: Dumbbell,
    title: "Log as you lift",
    body: "Add today's workout and fill in sets, reps and weight between sets. Flag drop sets and supersets, pick barbell, dumbbell or machine.",
  },
  {
    icon: TrendingUp,
    title: "See progress",
    body: "Every exercise gets a trend line — estimated 1RM, top set and volume over time — plus your all-time PRs.",
  },
  {
    icon: ListChecks,
    title: "Follow your split",
    body: "Build a Push / Pull / Legs template once, then start any day pre-filled and ready to go.",
  },
  {
    icon: Plus,
    title: "Your exercises",
    body: "Missing a movement? Add it in a tap. Custom exercises stay private to your account.",
  },
];

const steps = [
  {
    n: 1,
    title: "Start today's workout",
    body: "One tap from the dashboard, or load a template day.",
  },
  {
    n: 2,
    title: "Fill it in between sets",
    body: "Weight, reps, drop sets, supersets — as you go.",
  },
  {
    n: 3,
    title: "Watch the lines climb",
    body: "Finish, and every exercise updates its progress chart.",
  },
];

export default async function Home() {
  const session = await auth();
  const cta = session?.user ? "/dashboard" : "/sign-in";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[46rem] max-w-[120vw] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--brand)" }}
          />
          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
            <span className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
              <FrogMark className="size-4" />
              Gym progress tracker
            </span>
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Track every set. Watch every lift go up.
            </h1>
            <p className="text-muted-foreground max-w-xl text-base text-pretty sm:text-lg">
              ProgFrog is a fast workout log — record what you actually did in the gym,
              then let the charts show you the progress.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg">
                <Link href={cta}>
                  {session?.user ? "Go to dashboard" : "Get started"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dashboard/templates">Build a split</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="hover:ring-primary/25 transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                      <Icon className="size-4" />
                    </span>
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  {body}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Three steps, every session
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="flex flex-col gap-2">
                  <span className="bg-primary/10 text-primary font-heading flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                    {s.n}
                  </span>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="text-muted-foreground text-sm">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Button asChild size="lg">
                <Link href={cta}>
                  {session?.user ? "Open ProgFrog" : "Start logging"}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-5xl items-center gap-2 px-4 py-6 text-sm sm:px-6">
          <FrogMark className="size-4" />
          ProgFrog — keep leaping forward.
        </div>
      </footer>
    </>
  );
}
