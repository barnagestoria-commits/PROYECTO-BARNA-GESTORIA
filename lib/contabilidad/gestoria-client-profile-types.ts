import type { AccountingPlanType, GestoriaEntityType } from "@prisma/client"
import type { CompanyFiscalSettingsDto } from "@/lib/fiscal/fiscal-settings"

export interface GestoriaBankAccount {
  id: string
  entity?: string
  office?: string
  controlDigit?: string
  accountNumber?: string
  iban?: string
  accountCode?: string
  bankName?: string
  isDefault?: boolean
  isFeeAccount?: boolean
  contactPerson?: string
  email?: string
  phone?: string
}

export interface GestoriaActivity {
  id: string
  epigraph?: string
  description?: string
  type?: string
  estimation?: string
  vatRegime?: string
  isMain?: boolean
  cashCriteria?: boolean
  sii?: boolean
  startDate?: string
  endDate?: string
  vatType?: string
  vatPercent?: number
}

export interface GestoriaRelatedPerson {
  id: string
  category: "representante" | "socio" | "contacto"
  name: string
  nif?: string
  role?: string
  powerDate?: string
  notary?: string
}

export interface GestoriaLocale {
  id: string
  code: string
  cadastralRef?: string
  streetType?: string
  streetName?: string
  streetNumber?: string
  floor?: string
  door?: string
  city?: string
  postalCode?: string
  province?: string
  surfaceM2?: number
  nature?: string
}

export interface GestoriaFormalObligations {
  monthlyRefundRegistry?: boolean
  entityExemptCorporateTax?: boolean
  largeCompany?: boolean
  equivalenceSurcharge?: boolean
  simplifiedVatRegime?: boolean
  agricultureRegime?: boolean
  incomeAttributionEntity?: boolean
  notes?: string
}

export interface GestoriaImpresosConfig {
  model111?: boolean
  model115?: boolean
  model123?: boolean
  model180?: boolean
  model303?: boolean
  model347?: boolean
  model349?: boolean
  model390?: boolean
  presentsViaDespacho?: boolean
  negativeVatCompensate?: boolean
  siiEnabled?: boolean
}

export interface GestoriaInmovilizadoParams {
  enabled?: boolean
  investmentGoods?: boolean
  assets?: boolean
  accountDigits?: number
  closingMonth?: number
  referenceNumberMode?: string
  splitVatAccounts?: boolean
  splitWithholdingAccounts?: boolean
  autoDocumentNumber?: boolean
  issuesB2BInvoices?: boolean
}

export interface GestoriaProrrataConfig {
  enabled?: boolean
  type?: string
  percent?: number
}

export interface GestoriaModulesConfig {
  inmovilizado?: boolean
  tesoreria?: boolean
  analitica?: boolean
}

export interface GestoriaClientProfileDto {
  clientCode: string
  entityType: GestoriaEntityType
  accountingPlanType: AccountingPlanType
  email: string
  phone: string
  fax: string
  website: string
  streetType: string
  streetName: string
  streetNumber: string
  floor: string
  door: string
  postalCode: string
  city: string
  province: string
  country: string
  technicianName: string
  responsibleCode: string
  accessPath: string
  modules: GestoriaModulesConfig
  feeBank: GestoriaBankAccount | null
  bankAccounts: GestoriaBankAccount[]
  activities: GestoriaActivity[]
  relatedPersons: GestoriaRelatedPerson[]
  formalObligations: GestoriaFormalObligations
  locales: GestoriaLocale[]
  impresos: GestoriaImpresosConfig
  inmovilizadoParams: GestoriaInmovilizadoParams
  prorrata: GestoriaProrrataConfig
}

export interface GestoriaClientDetailDto {
  id: string
  name: string
  cif: string | null
  profile: GestoriaClientProfileDto
  fiscalSettings: CompanyFiscalSettingsDto
}

export const ACCOUNTING_PLAN_OPTIONS: Array<{ id: AccountingPlanType; label: string }> = [
  { id: "PGC_PYME", label: "Plan General Contable PYME" },
  { id: "PGC_GENERAL", label: "Plan General Contable (Normal)" },
  { id: "PGC_MICRO", label: "Plan General Contable Microempresas" },
]

export const ENTITY_TYPE_OPTIONS: Array<{ id: GestoriaEntityType; label: string }> = [
  { id: "PERSONA_JURIDICA", label: "Persona Jurídica · Imp. Sociedades" },
  { id: "PERSONA_FISICA", label: "Persona Física · IRPF" },
]

export function createEmptyGestoriaProfile(clientCode: string): GestoriaClientProfileDto {
  return {
    clientCode,
    entityType: "PERSONA_JURIDICA",
    accountingPlanType: "PGC_PYME",
    email: "",
    phone: "",
    fax: "",
    website: "",
    streetType: "CL",
    streetName: "",
    streetNumber: "",
    floor: "",
    door: "",
    postalCode: "",
    city: "",
    province: "",
    country: "ES",
    technicianName: "",
    responsibleCode: "",
    accessPath: "",
    modules: { inmovilizado: true, tesoreria: false, analitica: false },
    feeBank: null,
    bankAccounts: [],
    activities: [],
    relatedPersons: [],
    formalObligations: {},
    locales: [],
    impresos: {
      presentsViaDespacho: true,
      negativeVatCompensate: true,
    },
    inmovilizadoParams: {
      enabled: true,
      investmentGoods: true,
      accountDigits: 8,
      closingMonth: 12,
      referenceNumberMode: "Anual",
      splitVatAccounts: false,
      splitWithholdingAccounts: false,
      autoDocumentNumber: false,
      issuesB2BInvoices: true,
    },
    prorrata: { enabled: false, type: "General", percent: 0 },
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
