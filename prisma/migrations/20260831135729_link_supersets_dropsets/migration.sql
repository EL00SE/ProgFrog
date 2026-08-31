-- CreateEnum
CREATE TYPE "ExerciseLink" AS ENUM ('SUPERSET', 'DROP_SET');

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN "linkToNext" "ExerciseLink";

-- AlterTable
ALTER TABLE "TemplateExercise" ADD COLUMN "linkToNext" "ExerciseLink";

-- Convert the old numeric "superset group" model to the new "links to the next
-- exercise" model: any exercise immediately followed (by `order`) by another
-- exercise sharing its group becomes a SUPERSET link to that neighbour.
UPDATE "WorkoutExercise" we
SET "linkToNext" = 'SUPERSET'
FROM "WorkoutExercise" nxt
WHERE nxt."workoutId" = we."workoutId"
  AND nxt."order" > we."order"
  AND we."supersetGroup" IS NOT NULL
  AND nxt."supersetGroup" = we."supersetGroup"
  AND NOT EXISTS (
    SELECT 1 FROM "WorkoutExercise" mid
    WHERE mid."workoutId" = we."workoutId"
      AND mid."order" > we."order"
      AND mid."order" < nxt."order"
  );

-- DropColumn
ALTER TABLE "WorkoutExercise" DROP COLUMN "supersetGroup";

-- DropColumn
ALTER TABLE "TemplateExercise" DROP COLUMN "supersetGroup";
