-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "heightCm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "BodyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyEntry_userId_date_idx" ON "BodyEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "BodyEntry" ADD CONSTRAINT "BodyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

