import Link from "next/link";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Routes to the start-a-workout picker (template day / freestyle). */
export function StartWorkoutButton({
  label = "Start today's workout",
  size = "lg",
}: {
  label?: string;
  size?: "default" | "lg";
}) {
  return (
    <Button asChild size={size}>
      <Link href="/dashboard/workouts/new">
        <Play className="size-4" /> {label}
      </Link>
    </Button>
  );
}
