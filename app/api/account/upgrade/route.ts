import { NextResponse } from "next/server"
import { upgradeAccountPlan } from "@/lib/auth/service"
import { authErrorResponse } from "@/lib/auth/api-auth"
import type { AccountType } from "@/lib/types/auth"
import {
  ACCOUNT_TYPE_LABELS,
  getEmpresaTierById,
  getGestoriaTierById,
} from "@/lib/settings/subscription-plans"

export async function POST(request: Request) {
  try {
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

    if (targetAccountType === "GESTORIA") {
      if (!gestoriaTierId || !getGestoriaTierById(gestoriaTierId)) {
        return NextResponse.json(
          { success: false, error: "Selecciona un tramo de gestoría válido." },
          { status: 400 },
        )
      }
    }

    if (targetAccountType === "EMPRESA") {
      if (!empresaTierId || !getEmpresaTierById(empresaTierId)) {
        return NextResponse.json(
          { success: false, error: "Selecciona un tramo de empresa válido según tu volumen." },
          { status: 400 },
        )
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 800))

    const session = await upgradeAccountPlan(targetAccountType, {
      gestoriaTierId,
      empresaTierId,
    })

    let message = `Plan ${ACCOUNT_TYPE_LABELS[targetAccountType]} contratado correctamente.`

    if (targetAccountType === "GESTORIA" && gestoriaTierId) {
      const tier = getGestoriaTierById(gestoriaTierId)!
      message = `Plan Gestoría activado: hasta ${tier.maxClients} clientes por ${tier.priceLabel}/mes.`
    } else if (targetAccountType === "EMPRESA" && empresaTierId) {
      const tier = getEmpresaTierById(empresaTierId)!
      message =
        tier.priceEuros === null
          ? `${tier.name} activado. Te contactaremos con un presupuesto personalizado tras la evaluación.`
          : `${tier.name} activado: ${tier.priceLabel}/mes (tarifa provisional del primer año).`
    }

    return NextResponse.json({
      success: true,
      session,
      message,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
