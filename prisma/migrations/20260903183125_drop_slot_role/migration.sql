-- AlterTable
ALTER TABLE "TemplateExercise" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "WorkoutExercise" DROP COLUMN "role";

-- DropEnum
DROP TYPE "ExerciseRole";

