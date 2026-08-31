import { env } from "@/env";
import { getCurrentUser } from "@/lib/dal";
import { SiteHeader } from "@/components/site-header";
import { DashboardNav, DashboardTabBar } from "@/components/dashboard-nav";
import { ActiveWorkoutBar } from "@/components/active-workout-bar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { PageTransition } from "@/components/page-transition";
import { RestTimer } from "@/components/workout/rest-timer";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  // The training assistant is only wired up when an Anthropic key is configured —
  // no key, no floating widget. All of its code stays in place.
  const assistantEnabled = !!env.ANTHROPIC_API_KEY;
  const user = assistantEnabled ? await getCurrentUser() : null;

  return (
    <>
      <SiteHeader />
      <DashboardNav />
      <ActiveWorkoutBar />
      <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip overscroll-x-contain px-4 pt-6 pb-28 sm:px-6 md:py-8">
        <PageTransition>{children}</PageTransition>
      </main>
      <DashboardTabBar />
      <RestTimer />
      {assistantEnabled ? <ChatWidget consented={!!user?.chatConsentAt} /> : null}
    </>
  );
}
