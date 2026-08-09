-- AlterTable
ALTER TABLE "CompanyGestoriaProfile" ADD COLUMN IF NOT EXISTS "registroMercantilJson" TEXT;
ALTER TABLE "CompanyGestoriaProfile" ADD COLUMN IF NOT EXISTS "invoiceTemplateJson" TEXT;
