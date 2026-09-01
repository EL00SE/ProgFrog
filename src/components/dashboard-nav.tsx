"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  ListChecks,
  Settings,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/workouts", label: "Workouts", icon: CalendarDays },
  { href: "/dashboard/progress", label: "Progress", icon: TrendingUp },
  { href: "/dashboard/templates", label: "Templates", icon: ListChecks },
  { href: "/dashboard/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Top nav — desktop only. */
export function DashboardNav() {
  const isActive = useActive();

  return (
    <nav
      aria-label="Sections"
      className="bg-background/80 sticky top-14 z-30 hidden border-b backdrop-blur md:block"
    >
      <div className="mx-auto flex max-w-5xl gap-1 px-4 py-2">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Bottom tab bar — mobile only. Settings lives in the avatar menu on mobile. */
export function DashboardTabBar() {
  const isActive = useActive();
  const tabs = links.slice(0, 5);

  return (
    <nav
      aria-label="Primary"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
    >
      <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[0.7rem] leading-none font-medium transition-colors",
                active && "text-primary",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-primary/10",
                )}
              >
                <Icon className="size-6" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
