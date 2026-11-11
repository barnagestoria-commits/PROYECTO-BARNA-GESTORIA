-- AlterTable
ALTER TABLE "User" ADD COLUMN "isPlatformOperator" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SupportAccessEvent" (
    "id" TEXT NOT NULL,
    "operatorUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAccessEvent_operatorUserId_createdAt_idx" ON "SupportAccessEvent"("operatorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportAccessEvent_companyId_createdAt_idx" ON "SupportAccessEvent"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportAccessEvent" ADD CONSTRAINT "SupportAccessEvent_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessEvent" ADD CONSTRAINT "SupportAccessEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
