-- CreateEnum
CREATE TYPE "TaxReturnStatus" AS ENUM ('DRAFT', 'VALIDATED', 'EXPORTED', 'SUBMITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaxExportFormat" AS ENUM ('DR303_ENVELOPE', 'BOE_500', 'XML_WS');

-- CreateTable
CREATE TABLE "TaxModelVersion" (
    "id" TEXT NOT NULL,
    "versionKey" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL,
    "exercise" INTEGER NOT NULL,
    "periodScope" TEXT,
    "revision" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sha256Prefix" TEXT NOT NULL,
    "format" "TaxExportFormat" NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxModelSource" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sha256" TEXT,
    "storageKey" TEXT,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxModelSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReturn" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "status" "TaxReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReturnValue" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "casilla" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxReturnValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxReturnValueSource" (
    "id" TEXT NOT NULL,
    "returnValueId" TEXT NOT NULL,
    "entryId" TEXT,
    "lineId" TEXT,
    "concept" TEXT,
    "accountCode" TEXT,

    CONSTRAINT "TaxReturnValueSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "returnId" TEXT,
    "modelCode" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "casilla" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxValidationResult" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "format" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxExportArtifact" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "format" "TaxExportFormat" NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxAuditEvent" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxModelVersion_versionKey_key" ON "TaxModelVersion"("versionKey");

-- CreateIndex
CREATE INDEX "TaxModelVersion_modelCode_exercise_idx" ON "TaxModelVersion"("modelCode", "exercise");

-- CreateIndex
CREATE INDEX "TaxModelSource_versionId_idx" ON "TaxModelSource"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxReturn_companyId_versionId_year_period_key" ON "TaxReturn"("companyId", "versionId", "year", "period");

-- CreateIndex
CREATE INDEX "TaxReturn_companyId_year_idx" ON "TaxReturn"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "TaxReturnValue_returnId_casilla_key" ON "TaxReturnValue"("returnId", "casilla");

-- CreateIndex
CREATE INDEX "TaxFact_companyId_modelCode_year_period_idx" ON "TaxFact"("companyId", "modelCode", "year", "period");

-- CreateIndex
CREATE INDEX "TaxFact_returnId_idx" ON "TaxFact"("returnId");

-- CreateIndex
CREATE INDEX "TaxAuditEvent_returnId_createdAt_idx" ON "TaxAuditEvent"("returnId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaxModelSource" ADD CONSTRAINT "TaxModelSource_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaxModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturn" ADD CONSTRAINT "TaxReturn_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TaxModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturnValue" ADD CONSTRAINT "TaxReturnValue_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxReturnValueSource" ADD CONSTRAINT "TaxReturnValueSource_returnValueId_fkey" FOREIGN KEY ("returnValueId") REFERENCES "TaxReturnValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFact" ADD CONSTRAINT "TaxFact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFact" ADD CONSTRAINT "TaxFact_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxValidationResult" ADD CONSTRAINT "TaxValidationResult_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxExportArtifact" ADD CONSTRAINT "TaxExportArtifact_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxAuditEvent" ADD CONSTRAINT "TaxAuditEvent_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "TaxReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed versión normativa 303 / 2026
INSERT INTO "TaxModelVersion" (
  "id", "versionKey", "modelCode", "exercise", "periodScope", "revision",
  "sourceLabel", "sourceUrl", "sha256Prefix", "format", "effectiveFrom", "createdAt"
) VALUES (
  'taxmv_303_2026_101',
  'AEAT:303:2026:TRIM:101',
  '303',
  2026,
  'TRIM',
  '101',
  'DR303e26v101',
  'https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_26/DR303e26v101.xlsx',
  '0be8b156',
  'DR303_ENVELOPE',
  '2026-01-28',
  CURRENT_TIMESTAMP
);

INSERT INTO "TaxModelSource" (
  "id", "versionId", "label", "url", "createdAt"
) VALUES (
  'taxms_303_2026_dr',
  'taxmv_303_2026_101',
  'Diseño registro 303 ejercicio 2026',
  'https://sede.agenciatributaria.gob.es/static_files/Sede/Disenyo_registro/DR_300_399/archivos_26/DR303e26v101.xlsx',
  CURRENT_TIMESTAMP
);
