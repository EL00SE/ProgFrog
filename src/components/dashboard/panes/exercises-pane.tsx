import { PageHeader } from "@/components/page-header";
import {
  type CustomExercise,
  ExerciseManager,
  type GlobalExercise,
} from "@/components/exercises/exercise-manager";
import { Pane } from "@/components/dashboard/pane";

export function ExercisesPane({
  globals,
  custom,
}: {
  globals: GlobalExercise[];
  custom: CustomExercise[];
}) {
  return (
    <Pane>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Exercises"
          description="The shared catalog plus your own custom exercises. Custom ones are private to your account."
        />
        <ExerciseManager globals={globals} custom={custom} />
      </div>
    </Pane>
  );
}
