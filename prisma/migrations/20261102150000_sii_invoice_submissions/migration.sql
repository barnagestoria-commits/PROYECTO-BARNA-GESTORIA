CREATE TABLE "SiiInvoiceSubmission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "ejercicio" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "invoiceKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "csv" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiiInvoiceSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiiInvoiceSubmission_companyId_invoiceKey_key" ON "SiiInvoiceSubmission"("companyId", "invoiceKey");

CREATE INDEX "SiiInvoiceSubmission_companyId_ejercicio_periodo_idx" ON "SiiInvoiceSubmission"("companyId", "ejercicio", "periodo");

ALTER TABLE "SiiInvoiceSubmission" ADD CONSTRAINT "SiiInvoiceSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
