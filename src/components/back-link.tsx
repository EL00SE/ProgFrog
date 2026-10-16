import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function BackLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm transition-colors",
        className,
      )}
    >
      <ChevronLeft className="size-4" />
      {children}
    </Link>
  );
}
