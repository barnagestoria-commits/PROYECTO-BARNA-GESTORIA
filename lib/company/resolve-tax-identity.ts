import { prisma } from "@/lib/db"
import type { CompanySiiMode } from "@/lib/company/sii"

export interface CompanyTaxIdentity {
  name: string
  cif: string | null
  taxDirectDebitIban: string | null
  salesCollectionIban: string | null
  salesCollectionBank: string | null
  siiMode: CompanySiiMode
  cashBasisSubject: boolean
  cashBasisRecipient: boolean
}

function normalizeTaxId(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  return cleaned || null
}

export async function resolveCompanyTaxIdentity(companyId: string): Promise<CompanyTaxIdentity> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      cif: true,
      taxDirectDebitIban: true,
      salesCollectionIban: true,
      salesCollectionBank: true,
      siiMode: true,
      cashBasisSubject: true,
      cashBasisRecipient: true,
      digitalCertificate: {
        select: {
          taxId: true,
          holderName: true,
        },
      },
    },
  })

  if (!company) {
    throw new Error("Empresa no encontrada.")
  }

  const certificateTaxId = normalizeTaxId(company.digitalCertificate?.taxId)
  const companyCif = normalizeTaxId(company.cif)
  const certificateName = company.digitalCertificate?.holderName?.trim()

  return {
    name: certificateName || company.name,
    cif: certificateTaxId ?? companyCif,
    taxDirectDebitIban: company.taxDirectDebitIban,
    salesCollectionIban: company.salesCollectionIban,
    salesCollectionBank: company.salesCollectionBank,
    siiMode: company.siiMode,
    cashBasisSubject: company.cashBasisSubject,
    cashBasisRecipient: company.cashBasisRecipient,
  }
}
