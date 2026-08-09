-- CreateTable
CREATE TABLE "CompanyDigitalCertificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "environment" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDigitalCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDigitalCertificate_companyId_key" ON "CompanyDigitalCertificate"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyDigitalCertificate" ADD CONSTRAINT "CompanyDigitalCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
