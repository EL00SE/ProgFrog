-- CreateEnum
CREATE TYPE "ExerciseRole" AS ENUM ('MAIN', 'SECONDARY', 'ISOLATION', 'ACCESSORY');

-- DropForeignKey
ALTER TABLE "TemplateExercise" DROP CONSTRAINT "TemplateExercise_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutExercise" DROP CONSTRAINT "WorkoutExercise_exerciseId_fkey";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "role" "ExerciseRole";

-- AlterTable
ALTER TABLE "TemplateExercise" ADD COLUMN     "muscle" TEXT,
ADD COLUMN     "role" "ExerciseRole",
ALTER COLUMN "exerciseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN     "muscle" TEXT,
ADD COLUMN     "role" "ExerciseRole",
ALTER COLUMN "exerciseId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateExercise" ADD CONSTRAINT "TemplateExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill muscle snapshots onto existing slot rows from their linked exercise.
UPDATE "WorkoutExercise" we SET "muscle" = e."muscle"
  FROM "Exercise" e WHERE we."exerciseId" = e."id";
UPDATE "TemplateExercise" te SET "muscle" = e."muscle"
  FROM "Exercise" e WHERE te."exerciseId" = e."id";
