-- AlterTable
ALTER TABLE "CompanyDigitalCertificate" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "CompanyDigitalCertificate" ADD COLUMN "contentType" TEXT;
ALTER TABLE "CompanyDigitalCertificate" ADD COLUMN "sha256" TEXT;
ALTER TABLE "CompanyDigitalCertificate" ADD COLUMN "byteSize" INTEGER;

-- AlterTable
ALTER TABLE "FiscalDocument" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "FiscalDocument" ADD COLUMN "contentType" TEXT;
ALTER TABLE "FiscalDocument" ADD COLUMN "sha256" TEXT;

-- AlterTable
ALTER TABLE "BankStatementImport" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "BankStatementImport" ADD COLUMN "contentType" TEXT;
ALTER TABLE "BankStatementImport" ADD COLUMN "sha256" TEXT;
