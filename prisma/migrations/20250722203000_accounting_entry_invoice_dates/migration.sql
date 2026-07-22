-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN "issueDate" DATE,
ADD COLUMN "operationDate" DATE,
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceDataJson" TEXT;
