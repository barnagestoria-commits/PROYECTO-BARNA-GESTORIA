-- AlterTable: add refNumber (nullable first for backfill)
ALTER TABLE "AccountingEntry" ADD COLUMN "refNumber" INTEGER;

-- Backfill sequential ref numbers per company (by creation order)
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "AccountingEntry"
)
UPDATE "AccountingEntry" AS e
SET "refNumber" = n.rn
FROM numbered AS n
WHERE e.id = n.id;

-- Enforce NOT NULL and uniqueness
ALTER TABLE "AccountingEntry" ALTER COLUMN "refNumber" SET NOT NULL;

CREATE UNIQUE INDEX "AccountingEntry_companyId_refNumber_key" ON "AccountingEntry"("companyId", "refNumber");
