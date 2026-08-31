
-- AlterTable
ALTER TABLE "SetEntry" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SetEntry_clientId_key" ON "SetEntry"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_clientId_key" ON "WorkoutExercise"("clientId");

