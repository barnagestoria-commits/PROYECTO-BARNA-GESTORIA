ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M130';

ALTER TABLE "CompanyFiscalSettings"
ADD COLUMN "model130Enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AccountingDataImport"
ADD COLUMN "fiscalResultsJson" TEXT;

UPDATE "CompanyFiscalSettings"
SET "model130Enabled" = true
WHERE "clientProfile" IN ('AUTONOMO', 'PERSONA_FISICA')
  AND "model303Enabled" = true;
