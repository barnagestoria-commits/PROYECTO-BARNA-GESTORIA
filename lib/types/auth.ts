export type AccountType = "GESTORIA" | "CLIENTE_FINAL" | "EMPRESA"

export type UserRole = "ADMIN_GESTOR" | "GESTOR" | "CLIENTE"

export interface CompanySummary {
  id: string
  name: string
  cif: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  accountId: string
  accountType: AccountType
  accountName: string
}

export interface AuthSession {
  user: AuthUser
  companies: CompanySummary[]
  activeCompanyId: string | null
  canSwitchCompanies: boolean
}

export interface RegisterRequest {
  name: string
  email: string
  phone?: string
  password: string
  accountType: AccountType
  companyName: string
  cif?: string
}

export interface LoginRequest {
  email: string
  password: string
}
