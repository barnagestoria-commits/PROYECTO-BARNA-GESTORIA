-- AlterEnum
ALTER TYPE "FiscalModelCode" ADD VALUE 'M180';

-- CreateEnum
CREATE TYPE "AmortizationPeriodization" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "DataImportStatus" AS ENUM ('PENDIENTE', 'PROCESADO', 'ERROR');

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cuentaInmovilizado" TEXT NOT NULL,
    "cuentaAmortAcumulada" TEXT NOT NULL,
    "cuentaGastoAmort" TEXT NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "acquisitionCost" DECIMAL(14,2) NOT NULL,
    "residualValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "accumulatedAmort" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetCostDistribution" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "FixedAssetCostDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmortizationSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodization" "AmortizationPeriodization" NOT NULL DEFAULT 'TRIMESTRAL',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmortizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmortizationRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "entryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmortizationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingDataImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" "DataImportStatus" NOT NULL DEFAULT 'PENDIENTE',
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingDataImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedAsset_companyId_isActive_idx" ON "FixedAsset"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_companyId_code_key" ON "FixedAsset"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_companyId_code_key" ON "CostCenter"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetCostDistribution_fixedAssetId_costCenterId_key" ON "FixedAssetCostDistribution"("fixedAssetId", "costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "AmortizationSettings_companyId_key" ON "AmortizationSettings"("companyId");

-- CreateIndex
CREATE INDEX "AmortizationRun_companyId_periodStart_idx" ON "AmortizationRun"("companyId", "periodStart");

-- CreateIndex
CREATE INDEX "AccountingDataImport_companyId_createdAt_idx" ON "AccountingDataImport"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCostDistribution" ADD CONSTRAINT "FixedAssetCostDistribution_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCostDistribution" ADD CONSTRAINT "FixedAssetCostDistribution_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmortizationSettings" ADD CONSTRAINT "AmortizationSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmortizationRun" ADD CONSTRAINT "AmortizationRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDataImport" ADD CONSTRAINT "AccountingDataImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
