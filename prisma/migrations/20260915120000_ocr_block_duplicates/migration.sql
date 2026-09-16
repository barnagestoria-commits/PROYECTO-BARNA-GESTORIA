-- OCR: bloquear facturas duplicadas (mismo NIF y número) al confirmar
ALTER TABLE "CompanyAccountingSettings" ADD COLUMN "ocrBlockDuplicates" BOOLEAN NOT NULL DEFAULT true;
