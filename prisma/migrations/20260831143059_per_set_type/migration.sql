-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('WARMUP', 'NORMAL', 'DROP', 'FAILURE');

-- CreateTable
CREATE TABLE "TemplateSet" (
    "id" TEXT NOT NULL,
    "templateExerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" "SetType" NOT NULL DEFAULT 'NORMAL',
    "targetReps" TEXT,

    CONSTRAINT "TemplateSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateSet_templateExerciseId_idx" ON "TemplateSet"("templateExerciseId");

-- AddForeignKey
ALTER TABLE "TemplateSet" ADD CONSTRAINT "TemplateSet_templateExerciseId_fkey" FOREIGN KEY ("templateExerciseId") REFERENCES "TemplateExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: expand each template slot's `targetSets` count into NORMAL rows.
INSERT INTO "TemplateSet" ("id", "templateExerciseId", "order", "type", "targetReps")
SELECT gen_random_uuid()::text, te."id", g.n, 'NORMAL', NULL
FROM "TemplateExercise" te
CROSS JOIN LATERAL generate_series(0, GREATEST(COALESCE(te."targetSets", 3), 1) - 1) AS g(n);

-- AlterTable
ALTER TABLE "TemplateExercise" DROP COLUMN "targetSets";

-- AlterTable: SetEntry boolean flags -> single `type` enum + a rep-target snapshot.
ALTER TABLE "SetEntry" ADD COLUMN "targetReps" TEXT,
ADD COLUMN     "type" "SetType" NOT NULL DEFAULT 'NORMAL';

UPDATE "SetEntry" SET "type" = 'WARMUP' WHERE "isWarmup" = true;
UPDATE "SetEntry" SET "type" = 'DROP' WHERE "isDropSet" = true AND "isWarmup" = false;

ALTER TABLE "SetEntry" DROP COLUMN "isDropSet",
DROP COLUMN "isWarmup";
