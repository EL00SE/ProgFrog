
-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_clientId_key" ON "Exercise"("clientId");

