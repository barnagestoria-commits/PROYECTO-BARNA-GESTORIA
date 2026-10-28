export type AccountType = "GESTORIA" | "CLIENTE_FINAL" | "EMPRESA"

export type UserRole = "ADMIN_GESTOR" | "GESTOR" | "CLIENTE"

export type CompanyKind = "STANDARD" | "GESTORIA_PROPIA" | "CLIENTE_CARTERA"

export interface CompanySummary {
  id: string
  name: string
  cif: string | null
  kind: CompanyKind
  /** Fecha de alta en autónomos o de la empresa, en formato AAAA-MM-DD. */
  activityStartDate?: string | null
  taxDirectDebitIban?: string | null
  taxDirectDebitBank?: string | null
  salesCollectionIban?: string | null
  salesCollectionBank?: string | null
  /** CNAE-2025 de la actividad principal, cuatro cifras. */
  cnae?: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: UserRole
  accountId: string
  accountType: AccountType
  accountName: string
}

export interface UpdateUserProfileRequest {
  name?: string
  email?: string
  phone?: string | null
  accountName?: string
  activeCompanyName?: string
  activeCompanyCif?: string | null
  activityStartDate?: string | null
  taxDirectDebitIban?: string | null
  taxDirectDebitBank?: string | null
  salesCollectionIban?: string | null
  salesCollectionBank?: string | null
  cnae?: string | null
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
