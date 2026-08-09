import { prisma } from "@/lib/db"

export interface CompanyTaxIdentity {
  name: string
  cif: string | null
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

  return {
    name: company.name,
    cif: companyCif ?? certificateTaxId,
  }
}
