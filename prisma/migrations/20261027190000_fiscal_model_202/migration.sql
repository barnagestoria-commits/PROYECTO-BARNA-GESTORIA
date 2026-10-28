ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M202';

ALTER TABLE "CompanyFiscalSettings"
ADD COLUMN "model202Enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CompanyFiscalSettings"
SET "model202Enabled" = true
WHERE "clientProfile" IN ('PYME', 'GRAN_EMPRESA');
