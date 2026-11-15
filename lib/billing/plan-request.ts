import type { AccountType } from "@/lib/types/auth"
import {
  AUTONOMO_PLAN,
  canUpgradeAccountType,
  canUpgradeEmpresaTier,
  canUpgradeGestoriaTier,
  getEmpresaTierById,
  getGestoriaTierById,
} from "@/lib/settings/subscription-plans"

export interface PlanDescription {
  accountType: AccountType
  tierId: string | null
  label: string
  /** Importe mensual en euros; null cuando es un presupuesto a medida. */
  priceEuros: number | null
}

/** Plan tal y como se enseña al cliente y al operador. Devuelve null si falta el tramo o no existe. */
export function describePlan(accountType: AccountType, tierId: string | null | undefined): PlanDescription | null {
  if (accountType === "CLIENTE_FINAL") {
    return {
      accountType,
      tierId: null,
      label: `Autónomo · ${AUTONOMO_PLAN.priceLabel}/mes`,
      priceEuros: AUTONOMO_PLAN.priceEuros,
    }
  }

  if (accountType === "EMPRESA") {
    const tier = tierId ? getEmpresaTierById(tierId) : null
    if (!tier) return null
    return {
      accountType,
      tierId: tier.id,
      label: tier.priceEuros === null ? `${tier.name} · presupuesto a medida` : `${tier.name} · ${tier.priceLabel}/mes`,
      priceEuros: tier.priceEuros,
    }
  }

  const tier = tierId ? getGestoriaTierById(tierId) : null
  if (!tier) return null
  return {
    accountType,
    tierId: tier.id,
    label: `Gestoría · hasta ${tier.maxClients} clientes · ${tier.priceLabel}/mes`,
    priceEuros: tier.priceEuros,
  }
}

/** Mensaje de error si el cambio de plan pedido no procede; null si es válido. */
export function validatePlanRequest(
  current: { accountType: AccountType; planTierId: string | null },
  target: AccountType,
  tierId: string | null,
): string | null {
  if (!describePlan(target, tierId)) {
    return target === "EMPRESA"
      ? "Selecciona un tramo de empresa válido según tu volumen."
      : "Selecciona un tramo de gestoría válido."
  }

  if (current.accountType === target) {
    if (target === "CLIENTE_FINAL") return null
    const allowed =
      target === "EMPRESA"
        ? canUpgradeEmpresaTier(current.planTierId, tierId!)
        : canUpgradeGestoriaTier(current.planTierId, tierId!)
    if (allowed || current.planTierId === tierId) return null
    return "Para bajar de tramo, contacta con soporte."
  }

  if (current.accountType === "GESTORIA") {
    return "Para cambiar a un plan inferior, contacta con soporte."
  }
  if (!canUpgradeAccountType(current.accountType, target)) {
    return "Mejora de plan no disponible."
  }
  return null
}
