-- CreateTable
CREATE TABLE "LedgerSubaccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentCode" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerSubaccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerSubaccount_companyId_parentCode_idx" ON "LedgerSubaccount"("companyId", "parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerSubaccount_companyId_accountCode_key" ON "LedgerSubaccount"("companyId", "accountCode");

-- AddForeignKey
ALTER TABLE "LedgerSubaccount" ADD CONSTRAINT "LedgerSubaccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
