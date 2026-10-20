import Link from "next/link";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export async function SiteHeader() {
  const session = await auth();

  return (
    // Installed on a phone the app draws under the status bar (black-translucent
    // + viewport-fit=cover), so the header pads itself below the clock and
    // battery; its blurred background still runs up behind them.
    <header className="bg-background/80 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo markClassName="size-7" />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
          ) : (
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
