import type { AccountType, CompanyKind, CompanySummary, UserRole } from "@/lib/types/auth"

export const DEFAULT_GESTORIA_SEATS = 8

export function isGestoriaOwnCompany(company: { kind?: CompanyKind | null }): boolean {
  return company.kind === "GESTORIA_PROPIA"
}

export function isCarteraCompany(company: { kind?: CompanyKind | null }): boolean {
  return company.kind !== "GESTORIA_PROPIA"
}

export function gestoriaCompanyOptionLabel(company: Pick<CompanySummary, "name" | "kind">): string {
  if (company.kind === "GESTORIA_PROPIA") {
    return `Gestoría · ${company.name}`
  }
  return company.name
}

export function canManageGestoriaTeam(accountType: AccountType, role: UserRole): boolean {
  return accountType === "GESTORIA" && role === "ADMIN_GESTOR"
}

export function canSeeGestoriaInternalBooks(accountType: AccountType, role: UserRole): boolean {
  return accountType === "GESTORIA" && role === "ADMIN_GESTOR"
}

export function selectCompaniesVisibleToUser(input: {
  accountType: AccountType
  role: UserRole
  companies: CompanySummary[]
  assignedCompanyIds: string[] | null
}): CompanySummary[] {
  const { accountType, role, companies, assignedCompanyIds } = input

  if (accountType !== "GESTORIA") {
    if (assignedCompanyIds && assignedCompanyIds.length > 0) {
      const allowed = new Set(assignedCompanyIds)
      return companies.filter((company) => allowed.has(company.id))
    }
    return companies
  }

  if (role === "ADMIN_GESTOR") {
    return companies
  }

  const assigned = new Set(assignedCompanyIds ?? [])
  return companies.filter(
    (company) => company.kind !== "GESTORIA_PROPIA" && assigned.has(company.id),
  )
}

export function remainingSeats(maxSeats: number, usedSeats: number): number {
  return Math.max(0, maxSeats - usedSeats)
}

export function assertSeatAvailable(maxSeats: number, usedSeats: number): void {
  if (usedSeats >= maxSeats) {
    throw new Error(`La licencia admite como máximo ${maxSeats} usuarios.`)
  }
}

export function assignedCarteraCompanyIds(
  requestedIds: string[],
  carteraCompanies: Array<{ id: string; kind?: CompanyKind | null }>,
): string[] {
  const allowed = new Set(
    carteraCompanies.filter((company) => company.kind !== "GESTORIA_PROPIA").map((company) => company.id),
  )
  return [...new Set(requestedIds.filter((id) => allowed.has(id)))]
}
