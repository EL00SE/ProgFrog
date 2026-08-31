-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "isTimed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SetEntry" ADD COLUMN     "seconds" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN     "targetReps" TEXT,
ADD COLUMN     "targetSets" INTEGER;

