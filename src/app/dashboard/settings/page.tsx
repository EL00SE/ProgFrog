import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { getCurrentUser } from "@/lib/dal";
import { currentUserHasPassword, signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { InstallButton } from "@/components/pwa/install-button";
import { PasswordCard } from "@/components/settings/password-card";
import { WeightUnitForm } from "@/components/settings/weight-unit-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const hasPassword = await currentUserHasPassword();

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
          <CardTitle>Install the app</CardTitle>
          <CardDescription>
            Add ProgFrog to your home screen or dock — it opens full-screen, with its own
            icon, and pages you&rsquo;ve visited work offline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstallButton />
        </CardContent>
      </Card>

      {user.email ? (
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              {hasPassword
                ? "We'll email a link to set a new password."
                : "You signed in with a provider. Add a password to sign in with email too."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordCard email={user.email} hasPassword={hasPassword} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {user.email ? `Signed in as ${user.email}` : "Signed in with X"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="size-4" /> Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
