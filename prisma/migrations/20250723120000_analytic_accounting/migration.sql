-- Contabilidad analítica: settings, distribución por línea y plantillas por cuenta
CREATE TABLE "CompanyAccountingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "analyticAccountingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAccountingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntryLineAnalyticDistribution" (
    "id" TEXT NOT NULL,
    "entryLineId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "EntryLineAnalyticDistribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountAnalyticTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountAnalyticTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyAccountingSettings_companyId_key" ON "CompanyAccountingSettings"("companyId");

CREATE UNIQUE INDEX "EntryLineAnalyticDistribution_entryLineId_costCenterId_key" ON "EntryLineAnalyticDistribution"("entryLineId", "costCenterId");
CREATE INDEX "EntryLineAnalyticDistribution_costCenterId_idx" ON "EntryLineAnalyticDistribution"("costCenterId");

CREATE UNIQUE INDEX "AccountAnalyticTemplate_companyId_accountCode_costCenterId_key" ON "AccountAnalyticTemplate"("companyId", "accountCode", "costCenterId");
CREATE INDEX "AccountAnalyticTemplate_companyId_accountCode_idx" ON "AccountAnalyticTemplate"("companyId", "accountCode");

ALTER TABLE "CompanyAccountingSettings" ADD CONSTRAINT "CompanyAccountingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryLineAnalyticDistribution" ADD CONSTRAINT "EntryLineAnalyticDistribution_entryLineId_fkey" FOREIGN KEY ("entryLineId") REFERENCES "EntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntryLineAnalyticDistribution" ADD CONSTRAINT "EntryLineAnalyticDistribution_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountAnalyticTemplate" ADD CONSTRAINT "AccountAnalyticTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountAnalyticTemplate" ADD CONSTRAINT "AccountAnalyticTemplate_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
