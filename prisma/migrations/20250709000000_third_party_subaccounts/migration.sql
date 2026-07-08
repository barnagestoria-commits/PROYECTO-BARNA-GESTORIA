-- CreateEnum
CREATE TYPE "ThirdPartyType" AS ENUM ('PROVEEDOR', 'CLIENTE');

-- AlterTable
ALTER TABLE "FiscalDocument" ADD COLUMN "accountingEntryId" TEXT;

-- CreateTable
CREATE TABLE "ThirdParty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ThirdPartyType" NOT NULL,
    "cif" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThirdParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThirdParty_companyId_type_idx" ON "ThirdParty"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdParty_companyId_type_cif_key" ON "ThirdParty"("companyId", "type", "cif");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdParty_companyId_accountCode_key" ON "ThirdParty"("companyId", "accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_accountingEntryId_key" ON "FiscalDocument"("accountingEntryId");

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdParty" ADD CONSTRAINT "ThirdParty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
