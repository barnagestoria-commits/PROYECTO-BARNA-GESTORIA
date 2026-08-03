import type { AccountingPlanType } from "@prisma/client"
import type { GestoriaClientEntityType } from "@/lib/contabilidad/gestoria-client-service"

/** Nivel de detalle en balances y legalización de libros (como A3). */
export type GestoriaAccountDetailLevel = "NIVEL_3" | "NIVEL_4" | "SUBCUENTAS"

/** Formatos de balance de situación (códigos A3SOC). */
export type GestoriaBalanceFormatId =
  | "BALANCE_PYMES"
  | "BALANCE_NORMAL"
  | "BALANCE_ABREVIADO"
  | "BALANCE_NORMAL_COOP"
  | "BALANCE_ABREVIADO_COOP"
  | "IRPF_SIMPLIFICADO"

export type GestoriaProfitLossFormatId = "PYG_PYMES" | "PYG_NORMAL" | "PYG_ABREVIADO" | "IRPF"

export interface GestoriaAnnualAccountsConfig {
  balanceFormat: GestoriaBalanceFormatId
  profitLossFormat: GestoriaProfitLossFormatId
  includeEcpn: boolean
  includeEfe: boolean
  includeMemoria: boolean
  comparativePreviousYear: boolean
  accountDetailLevel: GestoriaAccountDetailLevel
}

export interface GestoriaCorporateTaxConfig {
  enabled: boolean
  installmentPayments: boolean
  annualAccountsDeposit: boolean
}

export interface GestoriaBooksLegalizationConfig {
  libroDiario: boolean
  libroInventario: boolean
  libroCuentasAnuales: boolean
  listCoversAndCertifications: boolean
  includeAccountDescriptions: boolean
  accountDetailLevel: GestoriaAccountDetailLevel
}

/** Configuración de presentación fiscal y contable (A3SOC: IS, cuentas anuales, libros, 232). */
export interface GestoriaPresentationConfig {
  balanceFormat: GestoriaBalanceFormatId
  profitLossFormat: GestoriaProfitLossFormatId
  annualAccounts: GestoriaAnnualAccountsConfig
  corporateTax: GestoriaCorporateTaxConfig
  model232Enabled: boolean
  booksLegalization: GestoriaBooksLegalizationConfig
}

export const BALANCE_FORMAT_OPTIONS: Array<{
  id: GestoriaBalanceFormatId
  code: string
  label: string
  plan: string
}> = [
  { id: "BALANCE_PYMES", code: "105", label: "Balance Pymes", plan: "PGC-08" },
  { id: "BALANCE_NORMAL_COOP", code: "122", label: "Balance normal cooperativas", plan: "PGC-08" },
  { id: "BALANCE_ABREVIADO_COOP", code: "123", label: "Balance abreviado cooperativas", plan: "PGC-08" },
  { id: "BALANCE_NORMAL", code: "202", label: "Balance normal", plan: "PGC-90" },
  { id: "BALANCE_ABREVIADO", code: "203", label: "Balance abreviado", plan: "PGC-90" },
  { id: "IRPF_SIMPLIFICADO", code: "—", label: "Estimación directa / IRPF (autónomo)", plan: "IRPF" },
]

export const PROFIT_LOSS_FORMAT_OPTIONS: Array<{
  id: GestoriaProfitLossFormatId
  code: string
  label: string
}> = [
  { id: "PYG_PYMES", code: "102", label: "Pérdidas y ganancias Pymes" },
  { id: "PYG_NORMAL", code: "101", label: "Pérdidas y ganancias normal" },
  { id: "PYG_ABREVIADO", code: "103", label: "Pérdidas y ganancias abreviado" },
  { id: "IRPF", code: "—", label: "Cuenta de pérdidas y ganancias IRPF" },
]

export const ACCOUNT_DETAIL_LEVEL_OPTIONS: Array<{ id: GestoriaAccountDetailLevel; label: string }> =
  [
    { id: "NIVEL_3", label: "Cuentas de nivel 3" },
    { id: "NIVEL_4", label: "Cuentas de nivel 4" },
    { id: "SUBCUENTAS", label: "Subcuentas" },
  ]

export function defaultAccountingPlanForEntity(
  entityType: GestoriaClientEntityType,
): AccountingPlanType {
  return entityType === "fisica" ? "PGC_MICRO" : "PGC_PYME"
}

export function createDefaultPresentationConfig(
  entityType: GestoriaClientEntityType,
): GestoriaPresentationConfig {
  if (entityType === "fisica") {
    return {
      balanceFormat: "IRPF_SIMPLIFICADO",
      profitLossFormat: "IRPF",
      annualAccounts: {
        balanceFormat: "IRPF_SIMPLIFICADO",
        profitLossFormat: "IRPF",
        includeEcpn: false,
        includeEfe: false,
        includeMemoria: false,
        comparativePreviousYear: false,
        accountDetailLevel: "SUBCUENTAS",
      },
      corporateTax: {
        enabled: false,
        installmentPayments: false,
        annualAccountsDeposit: false,
      },
      model232Enabled: false,
      booksLegalization: {
        libroDiario: true,
        libroInventario: true,
        libroCuentasAnuales: false,
        listCoversAndCertifications: true,
        includeAccountDescriptions: true,
        accountDetailLevel: "SUBCUENTAS",
      },
    }
  }

  return {
    balanceFormat: "BALANCE_PYMES",
    profitLossFormat: "PYG_PYMES",
    annualAccounts: {
      balanceFormat: "BALANCE_PYMES",
      profitLossFormat: "PYG_PYMES",
      includeEcpn: true,
      includeEfe: false,
      includeMemoria: true,
      comparativePreviousYear: true,
      accountDetailLevel: "NIVEL_3",
    },
    corporateTax: {
      enabled: true,
      installmentPayments: true,
      annualAccountsDeposit: true,
    },
    model232Enabled: true,
    booksLegalization: {
      libroDiario: true,
      libroInventario: true,
      libroCuentasAnuales: true,
      listCoversAndCertifications: true,
      includeAccountDescriptions: true,
      accountDetailLevel: "NIVEL_3",
    },
  }
}

export function syncPresentationWithAccountingPlan(
  config: GestoriaPresentationConfig,
  accountingPlanType: AccountingPlanType,
  entityType: GestoriaClientEntityType,
): GestoriaPresentationConfig {
  if (entityType === "fisica") {
    return createDefaultPresentationConfig("fisica")
  }

  const next = { ...config, annualAccounts: { ...config.annualAccounts } }

  if (accountingPlanType === "PGC_GENERAL") {
    next.balanceFormat = "BALANCE_NORMAL"
    next.profitLossFormat = "PYG_NORMAL"
    next.annualAccounts.balanceFormat = "BALANCE_NORMAL"
    next.annualAccounts.profitLossFormat = "PYG_NORMAL"
  } else if (accountingPlanType === "PGC_MICRO") {
    next.balanceFormat = "BALANCE_ABREVIADO"
    next.profitLossFormat = "PYG_ABREVIADO"
    next.annualAccounts.balanceFormat = "BALANCE_ABREVIADO"
    next.annualAccounts.profitLossFormat = "PYG_ABREVIADO"
  } else {
    next.balanceFormat = "BALANCE_PYMES"
    next.profitLossFormat = "PYG_PYMES"
    next.annualAccounts.balanceFormat = "BALANCE_PYMES"
    next.annualAccounts.profitLossFormat = "PYG_PYMES"
  }

  return next
}
