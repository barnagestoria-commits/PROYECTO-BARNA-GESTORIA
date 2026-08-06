-- AlterEnum
ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M123';

-- AlterTable
ALTER TABLE "CompanyFiscalSettings" ADD COLUMN IF NOT EXISTS "model123Enabled" BOOLEAN NOT NULL DEFAULT false;

-- Enable modelo 123 for company profiles that declare dividend withholdings
UPDATE "CompanyFiscalSettings"
SET "model123Enabled" = true
WHERE "clientProfile" IN ('PYME', 'GRAN_EMPRESA');
