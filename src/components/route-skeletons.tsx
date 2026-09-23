import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";

/*
 * Instant loading states for the detail routes (`loading.tsx`). Without one, a
 * dynamic route isn't prefetched at all and a tap does nothing visible until
 * the server has rendered the whole page. With one, Next prefetches the shell,
 * so the screen changes on the tap and the content streams in.
 *
 * Each mirrors the real page's top so nothing jumps when it lands — the back
 * link is real, so it works while the page is still loading.
 */

function TitleBlock({ back, href }: { back: string; href: string }) {
  return (
    <div className="space-y-1">
      <BackLink href={href}>{back}</BackLink>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-7 w-56 sm:h-8" />
    </div>
  );
}

function CardBlock({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/** `/dashboard/workouts/[id]` — the logger or a finished workout. */
export function WorkoutSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <TitleBlock back="Workouts" href="/dashboard/workouts" />
      <Skeleton className="h-[4.25rem] w-full rounded-xl" />
      <CardBlock rows={3} />
      <CardBlock rows={2} />
    </div>
  );
}

/** `/dashboard/templates/[id]` — the template editor. */
export function TemplateSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <BackLink href="/dashboard/templates">Templates</BackLink>
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-7 w-52 sm:h-8" />
        <Skeleton className="h-16 w-full" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** `/dashboard/workouts/new` — the start picker. */
export function StartWorkoutSkeleton() {
  return (
    <div aria-busy className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="space-y-1">
        <BackLink href="/dashboard">Dashboard</BackLink>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Start a workout</h1>
        <p className="text-muted-foreground text-sm">
          Pick a day from a template, or go freestyle.
        </p>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

/** Anything else under `/dashboard` (settings, or a tab route — hidden there). */
export function PageSkeleton() {
  return (
    <div aria-busy className="flex max-w-lg flex-col gap-6">
      <Skeleton className="h-7 w-40 sm:h-8" />
      <CardBlock rows={1} />
      <CardBlock rows={1} />
    </div>
  );
}
