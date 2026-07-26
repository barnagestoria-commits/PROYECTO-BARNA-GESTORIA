-- CreateEnum
CREATE TYPE "AccountingPlanType" AS ENUM ('PGC_GENERAL', 'PGC_PYME', 'PGC_MICRO');

-- CreateEnum
CREATE TYPE "GestoriaEntityType" AS ENUM ('PERSONA_JURIDICA', 'PERSONA_FISICA');

-- CreateTable
CREATE TABLE "CompanyGestoriaProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientCode" TEXT NOT NULL,
    "entityType" "GestoriaEntityType" NOT NULL DEFAULT 'PERSONA_JURIDICA',
    "accountingPlanType" "AccountingPlanType" NOT NULL DEFAULT 'PGC_PYME',
    "email" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "website" TEXT,
    "streetType" TEXT,
    "streetName" TEXT,
    "streetNumber" TEXT,
    "floor" TEXT,
    "door" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'ES',
    "technicianName" TEXT,
    "responsibleCode" TEXT,
    "accessPath" TEXT,
    "modulesJson" TEXT,
    "feeBankJson" TEXT,
    "bankAccountsJson" TEXT,
    "activitiesJson" TEXT,
    "relatedPersonsJson" TEXT,
    "formalObligationsJson" TEXT,
    "localesJson" TEXT,
    "impresosJson" TEXT,
    "inmovilizadoParamsJson" TEXT,
    "prorrataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyGestoriaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyGestoriaProfile_companyId_key" ON "CompanyGestoriaProfile"("companyId");

-- CreateIndex
CREATE INDEX "CompanyGestoriaProfile_clientCode_idx" ON "CompanyGestoriaProfile"("clientCode");

-- AddForeignKey
ALTER TABLE "CompanyGestoriaProfile" ADD CONSTRAINT "CompanyGestoriaProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
