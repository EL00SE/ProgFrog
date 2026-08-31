import { SiteHeader } from "@/components/site-header";
import { DashboardNav, DashboardTabBar } from "@/components/dashboard-nav";
import { ActiveWorkoutBar } from "@/components/active-workout-bar";
import { RouteFade } from "@/components/route-fade";
import { SwipeNav } from "@/components/swipe-nav";
import { RestTimer } from "@/components/workout/rest-timer";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <SiteHeader />
      <DashboardNav />
      <ActiveWorkoutBar />
      <SwipeNav>
        <main className="mx-auto w-full max-w-5xl flex-1 overscroll-x-contain px-4 pt-6 pb-28 sm:px-6 md:py-8">
          <RouteFade>{children}</RouteFade>
        </main>
      </SwipeNav>
      <DashboardTabBar />
      <RestTimer />
    </>
  );
}
