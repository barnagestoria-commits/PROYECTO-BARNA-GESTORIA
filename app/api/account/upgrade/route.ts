import { NextResponse } from "next/server"
import { requestAccountPlan } from "@/lib/auth/service"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import type { AccountType } from "@/lib/types/auth"
import { describePlan } from "@/lib/billing/plan-request"

/**
 * Pedir un plan. No cambia nada por sí solo: deja la solicitud guardada y el cliente paga por
 * transferencia en /checkout/transferencia. El plan se activa cuando el operador aprueba el pago.
 */
export async function POST(request: Request) {
  try {
    await requireRequestSession(request)

    const body = (await request.json()) as {
      targetAccountType?: AccountType
      gestoriaTierId?: string
      empresaTierId?: string
    }
    const { targetAccountType, gestoriaTierId, empresaTierId } = body

    if (!targetAccountType || !["GESTORIA", "CLIENTE_FINAL", "EMPRESA"].includes(targetAccountType)) {
      return NextResponse.json(
        { success: false, error: "Indica un plan de destino válido." },
        { status: 400 },
      )
    }

    const session = await requestAccountPlan(targetAccountType, { gestoriaTierId, empresaTierId })

    const tierId = targetAccountType === "GESTORIA" ? gestoriaTierId : empresaTierId
    const plan = describePlan(targetAccountType, tierId ?? null)

    return NextResponse.json({
      success: true,
      session,
      redirectTo: "/checkout/transferencia",
      message: `Solicitud registrada${plan ? `: ${plan.label}` : ""}. Haz la transferencia y sube el justificante; activaremos el plan cuando confirmemos el pago.`,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
