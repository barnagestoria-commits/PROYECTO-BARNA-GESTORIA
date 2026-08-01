-- CreateEnum
CREATE TYPE "BankMovementStatus" AS ENUM ('PENDIENTE', 'CONCILIADO', 'IGNORADO');

-- CreateEnum
CREATE TYPE "BankStatementSource" AS ENUM ('CSV', 'XLSX', 'OCR');

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" "BankStatementSource" NOT NULL,
    "bankAccountCode" TEXT,
    "movementCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "importId" TEXT,
    "movementDate" DATE NOT NULL,
    "valueDate" DATE,
    "concept" TEXT NOT NULL DEFAULT '',
    "reference" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance" DECIMAL(14,2),
    "status" "BankMovementStatus" NOT NULL DEFAULT 'PENDIENTE',
    "dedupeKey" TEXT NOT NULL,
    "matchedEntryId" TEXT,
    "matchedLineId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatementImport_companyId_createdAt_idx" ON "BankStatementImport"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "BankMovement_companyId_status_movementDate_idx" ON "BankMovement"("companyId", "status", "movementDate");

-- CreateIndex
CREATE UNIQUE INDEX "BankMovement_companyId_dedupeKey_key" ON "BankMovement"("companyId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "BankMovement_matchedLineId_key" ON "BankMovement"("matchedLineId");

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_matchedEntryId_fkey" FOREIGN KEY ("matchedEntryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_matchedLineId_fkey" FOREIGN KEY ("matchedLineId") REFERENCES "EntryLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
