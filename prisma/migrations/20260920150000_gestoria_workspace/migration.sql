-- CreateEnum
CREATE TYPE "CompanyKind" AS ENUM ('STANDARD', 'GESTORIA_PROPIA', 'CLIENTE_CARTERA');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "maxSeats" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "kind" "CompanyKind" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "ThirdParty" ADD COLUMN "email" TEXT;
ALTER TABLE "ThirdParty" ADD COLUMN "phone" TEXT;
ALTER TABLE "ThirdParty" ADD COLUMN "address" TEXT;
ALTER TABLE "ThirdParty" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "ThirdParty" ADD COLUMN "city" TEXT;

-- Clients already in the gestoría portfolio
UPDATE "Company" AS c
SET "kind" = 'CLIENTE_CARTERA'
FROM "CompanyGestoriaProfile" AS p
WHERE p."companyId" = c.id;

-- Gestoría shell company: same name as the account
UPDATE "Company" AS c
SET "kind" = 'GESTORIA_PROPIA'
FROM "Account" AS a
WHERE c."accountId" = a.id
  AND a."accountType" = 'GESTORIA'
  AND c."kind" = 'STANDARD'
  AND lower(trim(c."name")) = lower(trim(a."name"));

-- Remaining gestoría accounts without an internal company: oldest leftover becomes propia
UPDATE "Company" AS c
SET "kind" = 'GESTORIA_PROPIA'
WHERE c.id IN (
  SELECT DISTINCT ON (c2."accountId") c2.id
  FROM "Company" AS c2
  INNER JOIN "Account" AS a ON a.id = c2."accountId"
  WHERE a."accountType" = 'GESTORIA'
    AND NOT EXISTS (
      SELECT 1
      FROM "Company" AS c3
      WHERE c3."accountId" = c2."accountId"
        AND c3."kind" = 'GESTORIA_PROPIA'
    )
    AND c2."kind" = 'STANDARD'
  ORDER BY c2."accountId", c2."createdAt" ASC
);

-- Other leftover companies on a gestoría account belong to the portfolio
UPDATE "Company" AS c
SET "kind" = 'CLIENTE_CARTERA'
FROM "Account" AS a
WHERE c."accountId" = a.id
  AND a."accountType" = 'GESTORIA'
  AND c."kind" = 'STANDARD';

-- CreateIndex
CREATE INDEX "Company_accountId_kind_idx" ON "Company"("accountId", "kind");
