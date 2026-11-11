import type { CensusReading } from "@/lib/company/census-document"
import type { CorporateTaxCharacter } from "@/lib/company/corporate-tax"
import type { CompanySiiMode } from "@/lib/company/sii"

export type { CompanySiiMode }

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
  corporateTaxCharacter?: CorporateTaxCharacter
  censusDocumentName?: string | null
  censusDocumentKind?: string | null
  censusExtractedAt?: string | null
  censusExtractedJson?: string | null
  siiMode?: CompanySiiMode
  cashBasisSubject?: boolean
  cashBasisRecipient?: boolean
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
  /** Operador de Taxlyn: puede entrar en cualquier empresa para resolver incidencias. */
  isPlatformOperator: boolean
}

export interface SupportAccess {
  companyId: string
  companyName: string
  accountName: string
  ownerEmail: string | null
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
  corporateTaxCharacter?: CorporateTaxCharacter
  censusDocument?: { fileName: string; reading: CensusReading } | null
  siiMode?: CompanySiiMode
  cashBasisSubject?: boolean
  cashBasisRecipient?: boolean
}

export interface AuthSession {
  user: AuthUser
  companies: CompanySummary[]
  activeCompanyId: string | null
  canSwitchCompanies: boolean
  /** Empresa ajena en la que el operador está trabajando ahora. */
  supportAccess: SupportAccess | null
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
