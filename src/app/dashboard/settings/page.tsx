import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/dal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { WeightUnitForm } from "@/components/settings/weight-unit-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Weight unit</CardTitle>
          <CardDescription>
            Used for new workouts and everywhere weights are shown. Existing workouts keep
            the unit they were logged in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeightUnitForm current={user.weightUnit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Signed in as {user.email}
        </CardContent>
      </Card>
    </div>
  );
}
