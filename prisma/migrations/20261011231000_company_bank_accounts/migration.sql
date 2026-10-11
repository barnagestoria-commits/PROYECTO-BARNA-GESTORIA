-- Cuentas para domiciliar impuestos y cobrar facturas emitidas.
ALTER TABLE "Company" ADD COLUMN "taxDirectDebitIban" TEXT;
ALTER TABLE "Company" ADD COLUMN "taxDirectDebitBank" TEXT;
ALTER TABLE "Company" ADD COLUMN "salesCollectionIban" TEXT;
ALTER TABLE "Company" ADD COLUMN "salesCollectionBank" TEXT;
