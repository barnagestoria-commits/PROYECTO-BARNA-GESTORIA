import type { AccountType } from "@/lib/types/auth"

export interface AutonomoSubscriptionPlan {
  id: "autonomo"
  accountType: "CLIENTE_FINAL"
  name: string
  shortLabel: string
  priceEuros: number
  priceLabel: string
  priceNote: string
  description: string
  features: string[]
}

export interface EmpresaSubscriptionTier {
  id: string
  name: string
  minRevenueEuros: number
  maxRevenueEuros: number | null
  maxBankMovementsPerMonth: number | null
  priceEuros: number | null
  priceLabel: string
  priceNote: string
  description: string
}

export interface GestoriaSubscriptionTier {
  id: string
  maxClients: number
  priceEuros: number
  priceLabel: string
  priceNote: string
}

export const EMPRESA_PLAN_FEATURES = [
  "Cuenta en solitario para la sociedad (no gestoría)",
  "Contabilidad, fiscal e informes ampliados",
  "Multi-usuario y roles en la empresa",
  "Revisión de cuota en el primer año según actividad real",
]

export const EMPRESA_FIRST_YEAR_EVALUATION_NOTE =
  "Durante el primer año de suscripción aplicamos una tarifa provisional según la facturación declarada y el volumen estimado de movimientos bancarios. Al cumplirse 12 meses, recalculamos la cuota con los extractos reales y la cifra de negocios consolidada."

/** Plan fijo para autónomos. */
export const AUTONOMO_PLAN: AutonomoSubscriptionPlan = {
  id: "autonomo",
  accountType: "CLIENTE_FINAL",
  name: "Autónomo",
  shortLabel: "Autónomo",
  priceEuros: 100,
  priceLabel: "100 €",
  priceNote: "/ mes · facturación mensual",
  description: "Persona física o autónomo con su propio espacio de trabajo.",
  features: [
    "Panel financiero personal",
    "Facturas, extractos y contactos",
    "Modelos fiscales trimestrales",
    "Certificado digital Verifactu",
  ],
}

function formatEuros(amount: number): string {
  return `${amount.toLocaleString("es-ES")} €`
}

function formatRevenueLimit(amount: number | null): string {
  if (amount === null) return "Más de 1 M€"
  if (amount >= 1_000_000) return `Hasta ${(amount / 1_000_000).toFixed(1).replace(".0", "")} M€`
  return `Hasta ${formatEuros(amount)}`
}

/** Tramos empresa según facturación anual y movimientos bancarios mensuales. */
export const EMPRESA_SUBSCRIPTION_TIERS: EmpresaSubscriptionTier[] = [
  {
    id: "empresa-esencial",
    name: "Empresa Esencial",
    minRevenueEuros: 0,
    maxRevenueEuros: 500_000,
    maxBankMovementsPerMonth: 100,
    priceEuros: 450,
    priceLabel: "450 €",
    priceNote: "/ mes · tarifa provisional (año 1)",
    description: "Facturación hasta 500.000 € y hasta ~100 movimientos bancarios al mes.",
  },
  {
    id: "empresa-crecimiento",
    name: "Empresa Crecimiento",
    minRevenueEuros: 500_001,
    maxRevenueEuros: 1_000_000,
    maxBankMovementsPerMonth: 250,
    priceEuros: 750,
    priceLabel: "750 €",
    priceNote: "/ mes · tarifa provisional (año 1)",
    description: "Entre 500.000 € y 1 M€ de facturación o hasta ~250 movimientos/mes.",
  },
  {
    id: "empresa-avanzada",
    name: "Empresa Avanzada",
    minRevenueEuros: 1_000_001,
    maxRevenueEuros: 3_000_000,
    maxBankMovementsPerMonth: 500,
    priceEuros: 1_200,
    priceLabel: "1.200 €",
    priceNote: "/ mes · tarifa provisional (año 1)",
    description: "Hasta 3 M€ de facturación o alto volumen operativo (≈500 mov./mes).",
  },
  {
    id: "empresa-corporativa",
    name: "Empresa Corporativa",
    minRevenueEuros: 3_000_001,
    maxRevenueEuros: null,
    maxBankMovementsPerMonth: null,
    priceEuros: null,
    priceLabel: "Presupuesto",
    priceNote: " · cuota personalizada tras evaluación",
    description:
      "Sociedades con facturación muy elevada o volumen bancario intensivo. Cuota a medida tras análisis.",
  },
]

const GESTORIA_BASE_CLIENTS = 50
const GESTORIA_BASE_PRICE = 1000
const GESTORIA_CLIENT_STEP = 50
const GESTORIA_PRICE_STEP = 500
const GESTORIA_MAX_TIERS = 10

function buildGestoriaTier(maxClients: number): GestoriaSubscriptionTier {
  const steps = (maxClients - GESTORIA_BASE_CLIENTS) / GESTORIA_CLIENT_STEP
  const priceEuros = GESTORIA_BASE_PRICE + steps * GESTORIA_PRICE_STEP

  return {
    id: `gestoria-${maxClients}`,
    maxClients,
    priceEuros,
    priceLabel: formatEuros(priceEuros),
    priceNote: `/ mes · hasta ${maxClients} clientes`,
  }
}

export const GESTORIA_SUBSCRIPTION_TIERS: GestoriaSubscriptionTier[] = Array.from(
  { length: GESTORIA_MAX_TIERS },
  (_, index) => buildGestoriaTier(GESTORIA_BASE_CLIENTS + index * GESTORIA_CLIENT_STEP),
)

export const GESTORIA_PLAN_FEATURES = [
  "Cartera multi-cliente según tramo contratado",
  "Selector de empresa en la sidebar",
  "Informes, certificados y fiscal avanzado",
  "Roles de equipo (administrador y gestores)",
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CLIENTE_FINAL: "Autónomo",
  EMPRESA: "Empresa",
  GESTORIA: "Gestoría Profesional",
}

export const DEFAULT_GESTORIA_TIER_ID = GESTORIA_SUBSCRIPTION_TIERS[0].id
export const DEFAULT_EMPRESA_TIER_ID = EMPRESA_SUBSCRIPTION_TIERS[0].id

const UPGRADE_PATHS: Record<AccountType, AccountType[]> = {
  CLIENTE_FINAL: ["EMPRESA", "GESTORIA"],
  EMPRESA: ["GESTORIA"],
  GESTORIA: [],
}

export function getEmpresaTierById(tierId: string): EmpresaSubscriptionTier | null {
  return EMPRESA_SUBSCRIPTION_TIERS.find((tier) => tier.id === tierId) ?? null
}

export function getEmpresaTierLabel(tierId: string): string {
  const tier = getEmpresaTierById(tierId)
  if (!tier) return "Empresa"
  if (tier.priceEuros === null) {
    return `${tier.name} · presupuesto personalizado`
  }
  return `${tier.name} · ${tier.priceLabel}/mes (provisional)`
}

export function formatEmpresaTierCriteria(tier: EmpresaSubscriptionTier): string {
  const revenue = formatRevenueLimit(tier.maxRevenueEuros)
  const movements = tier.maxBankMovementsPerMonth
    ? `≤ ${tier.maxBankMovementsPerMonth} mov./mes`
    : "Volumen elevado"
  return `${revenue} · ${movements}`
}

export function getGestoriaTierById(tierId: string): GestoriaSubscriptionTier | null {
  return GESTORIA_SUBSCRIPTION_TIERS.find((tier) => tier.id === tierId) ?? null
}

export function getGestoriaTierLabel(tierId: string): string {
  const tier = getGestoriaTierById(tierId)
  if (!tier) return "Gestoría"
  return `Gestoría · hasta ${tier.maxClients} clientes (${tier.priceLabel}/mes)`
}

export function canUpgradeAccountType(
  currentAccountType: AccountType,
  targetAccountType: AccountType,
): boolean {
  if (currentAccountType === targetAccountType) return false
  if (currentAccountType === "GESTORIA") return false
  return UPGRADE_PATHS[currentAccountType]?.includes(targetAccountType) ?? false
}

export function canUpgradeGestoriaTier(
  currentTierId: string | null,
  targetTierId: string,
): boolean {
  const target = getGestoriaTierById(targetTierId)
  if (!target) return false
  if (!currentTierId) return true
  const current = getGestoriaTierById(currentTierId)
  if (!current) return true
  return target.maxClients > current.maxClients
}

export function canUpgradeEmpresaTier(
  currentTierId: string | null,
  targetTierId: string,
): boolean {
  const target = getEmpresaTierById(targetTierId)
  if (!target) return false
  if (!currentTierId) return true
  const current = getEmpresaTierById(currentTierId)
  if (!current) return true
  return (target.priceEuros ?? 999_999) > (current.priceEuros ?? 0)
}

export function getPlanSummary(
  accountType: AccountType,
  options?: { gestoriaTierId?: string | null; empresaTierId?: string | null },
) {
  if (accountType === "GESTORIA") {
    return {
      name: getGestoriaTierLabel(options?.gestoriaTierId ?? DEFAULT_GESTORIA_TIER_ID),
      shortLabel: ACCOUNT_TYPE_LABELS.GESTORIA,
    }
  }

  if (accountType === "EMPRESA") {
    return {
      name: getEmpresaTierLabel(options?.empresaTierId ?? DEFAULT_EMPRESA_TIER_ID),
      shortLabel: ACCOUNT_TYPE_LABELS.EMPRESA,
    }
  }

  return {
    name: AUTONOMO_PLAN.name,
    shortLabel: AUTONOMO_PLAN.shortLabel,
  }
}

/** @deprecated Usar getPlanSummary. */
export function getPlanForAccountType(accountType: AccountType) {
  return getPlanSummary(accountType)
}
