import type { AccountType, AuthSession, CompanySummary, UserRole } from "@/lib/types/auth"

export function canSwitchCompanies(accountType: AccountType, role: UserRole): boolean {
  return accountType === "GESTORIA" && (role === "ADMIN_GESTOR" || role === "GESTOR")
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN_GESTOR"
}

export function canAccessCompany(
  companyId: string,
  companies: CompanySummary[],
  canSwitch: boolean,
  activeCompanyId: string | null,
): boolean {
  const allowed = companies.some((company) => company.id === companyId)
  if (!allowed) return false

  if (canSwitch) return true
  return activeCompanyId === companyId
}

export function resolveActiveCompanyId(
  companies: CompanySummary[],
  preferredId?: string | null,
): string | null {
  if (companies.length === 0) return null
  if (preferredId && companies.some((company) => company.id === preferredId)) {
    return preferredId
  }
  return companies[0].id
}

export function getPanelTitle(session: AuthSession): string {
  if (session.user.accountType === "GESTORIA") {
    return "Panel Gestoría"
  }
  return "Panel Cliente"
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "ADMIN_GESTOR":
      return "Administrador gestoría"
    case "GESTOR":
      return "Gestor"
    case "CLIENTE":
      return "Cliente"
  }
}
