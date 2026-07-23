-- CreateTable
CREATE TABLE "AccountTreatmentConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "defaultCounterpartAccount" TEXT,
    "defaultVatOperation" TEXT DEFAULT '1',
    "defaultVatType" TEXT DEFAULT '04',
    "defaultVatPercent" DECIMAL(5,2),
    "defaultSurchargePercent" DECIMAL(5,2),
    "applySurcharge" BOOLEAN NOT NULL DEFAULT false,
    "defaultIrpfPercent" DECIMAL(5,2),
    "defaultIrpfAccount" TEXT,
    "defaultTaxForm" TEXT DEFAULT '347',
    "documentAccumulationType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTreatmentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountTreatmentConfig_companyId_accountCode_key" ON "AccountTreatmentConfig"("companyId", "accountCode");

-- CreateIndex
CREATE INDEX "AccountTreatmentConfig_companyId_idx" ON "AccountTreatmentConfig"("companyId");

-- AddForeignKey
ALTER TABLE "AccountTreatmentConfig" ADD CONSTRAINT "AccountTreatmentConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
