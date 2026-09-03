import type { Metadata } from "next";

// The Dashboard tab is rendered as a pane by `dashboard/layout.tsx` (the tab
// pager keeps all five tabs mounted). This route only carries the title.
export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return null;
}
