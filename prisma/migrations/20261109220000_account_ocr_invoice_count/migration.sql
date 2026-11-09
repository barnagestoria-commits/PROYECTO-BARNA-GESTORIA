-- Prueba gratuita de OCR: 8 facturas por cuenta de facturación.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "ocrInvoiceCount" INTEGER NOT NULL DEFAULT 0;
