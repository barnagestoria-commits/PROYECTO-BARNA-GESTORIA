-- CreateEnum
CREATE TYPE "FiscalModelCode" AS ENUM ('M111', 'M115', 'M303');

-- CreateEnum
CREATE TYPE "FiscalDeclarationStatus" AS ENUM ('SIN_DATOS', 'PENDIENTE', 'PRESENTADO');

-- CreateTable
CREATE TABLE "FiscalDeclaration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "modelCode" "FiscalModelCode" NOT NULL,
    "status" "FiscalDeclarationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalDeclaration_companyId_year_idx" ON "FiscalDeclaration"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDeclaration_companyId_year_quarter_modelCode_key" ON "FiscalDeclaration"("companyId", "year", "quarter", "modelCode");

-- AddForeignKey
ALTER TABLE "FiscalDeclaration" ADD CONSTRAINT "FiscalDeclaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
