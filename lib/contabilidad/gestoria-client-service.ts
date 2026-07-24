import type { CompanyClientProfile } from "@prisma/client"
import { prisma } from "@/lib/db"
import { DEFAULT_SETTINGS_BY_PROFILE } from "@/lib/fiscal/fiscal-settings"
import type { CompanySummary } from "@/lib/types/auth"

export type GestoriaClientEntityType = "juridica" | "fisica"

export interface CreateGestoriaClientInput {
  name: string
  cif?: string
  entityType: GestoriaClientEntityType
}

function normalizeCif(value: string | undefined): string | null {
  const trimmed = value?.trim().toUpperCase()
  return trimmed ? trimmed : null
}

export function resolveGestoriaClientProfile(
  entityType: GestoriaClientEntityType,
): CompanyClientProfile {
  if (entityType === "fisica") {
    return "PERSONA_FISICA"
  }
  return "PYME"
}

export async function createGestoriaClientCompany(
  accountId: string,
  userId: string,
  input: CreateGestoriaClientInput,
): Promise<CompanySummary> {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Indique el nombre o razón social del cliente.")
  }

  const cif = normalizeCif(input.cif)
  const profile = resolveGestoriaClientProfile(input.entityType)
  const fiscalDefaults = DEFAULT_SETTINGS_BY_PROFILE[profile]

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name,
        cif,
        accountId,
      },
    })

    await tx.userCompanyAccess.create({
      data: {
        userId,
        companyId: created.id,
      },
    })

    await tx.companyFiscalSettings.create({
      data: {
        companyId: created.id,
        ...fiscalDefaults,
      },
    })

    return created
  })

  return {
    id: company.id,
    name: company.name,
    cif: company.cif,
  }
}
