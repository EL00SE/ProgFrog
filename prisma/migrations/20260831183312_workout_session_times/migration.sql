-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows from the timestamps we already had.
UPDATE "Workout" SET "startedAt" = "createdAt";
UPDATE "Workout" SET "endedAt" = "finishedAt" WHERE "finishedAt" IS NOT NULL;
