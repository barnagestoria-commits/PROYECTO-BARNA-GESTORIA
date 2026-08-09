-- Extend fiscal model enum
ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M190';
ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M347';
ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M349';
ALTER TYPE "FiscalModelCode" ADD VALUE IF NOT EXISTS 'M390';

-- Per-company toggles for additional models
ALTER TABLE "CompanyFiscalSettings" ADD COLUMN IF NOT EXISTS "model190Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanyFiscalSettings" ADD COLUMN IF NOT EXISTS "model347Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanyFiscalSettings" ADD COLUMN IF NOT EXISTS "model349Enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanyFiscalSettings" ADD COLUMN IF NOT EXISTS "model390Enabled" BOOLEAN NOT NULL DEFAULT false;
