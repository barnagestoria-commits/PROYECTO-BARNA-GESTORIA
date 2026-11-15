import { prisma } from "@/lib/db"
import { describePlan, type PlanDescription } from "@/lib/billing/plan-request"

export interface CheckoutPlan {
  plan: PlanDescription | null
  /** Empresa o gestoría que aún no ha elegido tramo: hay que elegirlo antes de pagar. */
  needsPlanSelection: boolean
}

/**
 * Qué plan está pagando el cliente: el que pidió, o el que ya tiene si es fijo (autónomo)
 * o ya tiene tramo (renovación).
 */
export async function resolveCheckoutPlan(accountId: string): Promise<CheckoutPlan> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { accountType: true, requestedAccountType: true, requestedTierId: true, planTierId: true },
  })

  const plan = account.requestedAccountType
    ? describePlan(account.requestedAccountType, account.requestedTierId)
    : account.accountType === "CLIENTE_FINAL"
      ? describePlan("CLIENTE_FINAL", null)
      : describePlan(account.accountType, account.planTierId)

  return { plan, needsPlanSelection: plan === null }
}
