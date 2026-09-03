import { redirect } from "next/navigation";

import { env } from "@/env";
import { getCurrentUser } from "@/lib/dal";
import { getExerciseCatalog, getCustomExercises } from "@/lib/queries/exercises";
import { getTemplates } from "@/lib/queries/templates";
import {
  getActiveWorkout,
  getDashboardData,
  getWorkoutHistory,
} from "@/lib/queries/workouts";
import { SiteHeader } from "@/components/site-header";
import { DashboardNav, DashboardTabBar } from "@/components/dashboard-nav";
import { ActiveWorkoutBar } from "@/components/active-workout-bar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { RestTimer } from "@/components/workout/rest-timer";
import { TabPager } from "@/components/dashboard/tab-pager";
import { DashboardPane } from "@/components/dashboard/panes/dashboard-pane";
import { WorkoutsPane } from "@/components/dashboard/panes/workouts-pane";
import { ProgressPane } from "@/components/dashboard/panes/progress-pane";
import { TemplatesPane } from "@/components/dashboard/panes/templates-pane";
import { ExercisesPane } from "@/components/dashboard/panes/exercises-pane";

const TABS = [
  "/dashboard",
  "/dashboard/workouts",
  "/dashboard/progress",
  "/dashboard/templates",
  "/dashboard/exercises",
];
const TITLES = [
  "Dashboard · ProgFrog",
  "Workouts · ProgFrog",
  "Progress · ProgFrog",
  "Templates · ProgFrog",
  "Exercises · ProgFrog",
];

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const unit = user.weightUnit;

  const [active, dashboard, workouts, templates, catalog, custom] = await Promise.all([
    getActiveWorkout(user.id),
    getDashboardData(user.id, unit),
    getWorkoutHistory(user.id),
    getTemplates(user.id),
    getExerciseCatalog(user.id),
    getCustomExercises(user.id),
  ]);

  const assistantEnabled = !!env.ANTHROPIC_API_KEY;
  const globals = catalog
    .filter((e) => e.ownerId === null)
    .map((e) => ({ id: e.id, name: e.name, equipment: e.equipment, muscle: e.muscle }));
  const customExercises = custom.map((e) => ({
    id: e.id,
    name: e.name,
    equipment: e.equipment,
    muscle: e.muscle,
    isArchived: e.isArchived,
  }));

  const panes = [
    <DashboardPane
      key="dashboard"
      firstName={user.name?.split(" ")[0] ?? "there"}
      unit={unit}
      activeWorkout={active ? { id: active.id, name: active.name } : null}
      stats={dashboard.stats}
      recent={dashboard.recent}
      weeklyMuscleSets={dashboard.weeklyMuscleSets}
    />,
    <WorkoutsPane key="workouts" workouts={workouts} />,
    <ProgressPane
      key="progress"
      userId={user.id}
      unit={unit}
      heightCm={user.heightCm}
      birthday={user.birthday}
    />,
    <TemplatesPane key="templates" templates={templates} />,
    <ExercisesPane key="exercises" globals={globals} custom={customExercises} />,
  ];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <SiteHeader />
      <DashboardNav />
      <ActiveWorkoutBar />
      <TabPager tabs={TABS} titles={TITLES} panes={panes}>
        {children}
      </TabPager>
      <DashboardTabBar />
      <RestTimer />
      {assistantEnabled ? <ChatWidget consented={!!user.chatConsentAt} /> : null}
    </div>
  );
}
