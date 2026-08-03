import { NextResponse } from "next/server"
import type { AccountingPlanType } from "@prisma/client"
import { requireRequestSession } from "@/lib/auth/api-auth"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { createGestoriaClientCompany, type GestoriaClientEntityType } from "@/lib/contabilidad/gestoria-client-service"
import type { GestoriaPresentationConfig } from "@/lib/contabilidad/gestoria-presentation-config"

export async function GET(request: Request) {
  try {
    const session = await requireRequestSession(request)
    return NextResponse.json({ success: true, companies: session.companies })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRequestSession(request)

    if (session.user.accountType !== "GESTORIA") {
      return NextResponse.json(
        { success: false, error: "Solo las cuentas de gestoría pueden dar de alta clientes." },
        { status: 403 },
      )
    }

    const body = (await request.json()) as {
      name?: string
      cif?: string
      entityType?: GestoriaClientEntityType
      accountingPlanType?: AccountingPlanType
      presentation?: GestoriaPresentationConfig
    }

    const entityType = body.entityType === "fisica" ? "fisica" : "juridica"

    const company = await createGestoriaClientCompany(session.user.accountId, session.user.id, {
      name: body.name ?? "",
      cif: body.cif,
      entityType,
      accountingPlanType: body.accountingPlanType,
      presentation: body.presentation,
    })

    return NextResponse.json({ success: true, company })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
