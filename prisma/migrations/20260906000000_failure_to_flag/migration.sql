-- "To failure" stops being its own SetType — it becomes a `toFailure` flag on a
-- NORMAL working set. Add the column, fold existing FAILURE rows into
-- NORMAL + flag, then drop the enum value.

-- AlterTable
ALTER TABLE "SetEntry" ADD COLUMN "toFailure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TemplateSet" ADD COLUMN "toFailure" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a FAILURE set was a working set taken to failure.
UPDATE "SetEntry" SET "type" = 'NORMAL', "toFailure" = true WHERE "type" = 'FAILURE';
UPDATE "TemplateSet" SET "type" = 'NORMAL', "toFailure" = true WHERE "type" = 'FAILURE';

-- AlterEnum
BEGIN;
CREATE TYPE "SetType_new" AS ENUM ('WARMUP', 'NORMAL', 'DROP');
ALTER TABLE "SetEntry" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "TemplateSet" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "SetEntry" ALTER COLUMN "type" TYPE "SetType_new" USING ("type"::text::"SetType_new");
ALTER TABLE "TemplateSet" ALTER COLUMN "type" TYPE "SetType_new" USING ("type"::text::"SetType_new");
ALTER TYPE "SetType" RENAME TO "SetType_old";
ALTER TYPE "SetType_new" RENAME TO "SetType";
DROP TYPE "SetType_old";
ALTER TABLE "SetEntry" ALTER COLUMN "type" SET DEFAULT 'NORMAL';
ALTER TABLE "TemplateSet" ALTER COLUMN "type" SET DEFAULT 'NORMAL';
COMMIT;
