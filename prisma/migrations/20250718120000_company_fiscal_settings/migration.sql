-- CreateEnum
CREATE TYPE "CompanyClientProfile" AS ENUM ('PERSONA_FISICA', 'AUTONOMO', 'PYME', 'GRAN_EMPRESA');

-- CreateTable
CREATE TABLE "CompanyFiscalSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientProfile" "CompanyClientProfile" NOT NULL DEFAULT 'PYME',
    "model111Enabled" BOOLEAN NOT NULL DEFAULT true,
    "model115Enabled" BOOLEAN NOT NULL DEFAULT false,
    "model180Enabled" BOOLEAN NOT NULL DEFAULT false,
    "model303Enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFiscalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFiscalSettings_companyId_key" ON "CompanyFiscalSettings"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyFiscalSettings" ADD CONSTRAINT "CompanyFiscalSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
