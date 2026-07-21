import {
  EMPRESA_SUBSCRIPTION_TIERS,
  type EmpresaSubscriptionTier,
} from "@/lib/settings/subscription-plans"

export interface EmpresaSizingInput {
  annualRevenueEuros: number
  monthlyBankMovements: number
}

function tierRank(tier: EmpresaSubscriptionTier): number {
  return EMPRESA_SUBSCRIPTION_TIERS.findIndex((item) => item.id === tier.id)
}

/** Sugiere el tramo más exigente según facturación declarada y movimientos bancarios estimados. */
export function suggestEmpresaTier(input: EmpresaSizingInput): EmpresaSubscriptionTier {
  const { annualRevenueEuros, monthlyBankMovements } = input

  const byRevenue =
    EMPRESA_SUBSCRIPTION_TIERS.find(
      (tier) =>
        tier.maxRevenueEuros === null || annualRevenueEuros <= tier.maxRevenueEuros,
    ) ?? EMPRESA_SUBSCRIPTION_TIERS[EMPRESA_SUBSCRIPTION_TIERS.length - 1]

  const byMovements =
    EMPRESA_SUBSCRIPTION_TIERS.find(
      (tier) =>
        tier.maxBankMovementsPerMonth === null ||
        monthlyBankMovements <= tier.maxBankMovementsPerMonth,
    ) ?? EMPRESA_SUBSCRIPTION_TIERS[EMPRESA_SUBSCRIPTION_TIERS.length - 1]

  return tierRank(byRevenue) >= tierRank(byMovements) ? byRevenue : byMovements
}

export function formatRevenueInput(value: number): string {
  return `${value.toLocaleString("es-ES")} €`
}
