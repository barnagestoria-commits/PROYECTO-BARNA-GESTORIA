import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { generateFiscalLiquidationEntry } from "@/lib/fiscal/fiscal-liquidation-entry-service"
import { parseDetailQuarter } from "@/lib/fiscal/panorama"
import { isValidModelCode } from "@/lib/fiscal/panorama-service"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ model: string; year: string; quarter: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { model, year: yearParam, quarter: quarterParam } = await params
    const { companyId, session } = await requireActiveCompany(request)

    if (!isValidModelCode(model)) {
      return NextResponse.json({ success: false, error: "Modelo fiscal no válido." }, { status: 400 })
    }

    const year = Number.parseInt(yearParam, 10)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Año no válido." }, { status: 400 })
    }

    const quarter = parseDetailQuarter(quarterParam)
    if (!quarter || quarter === "annual") {
      return NextResponse.json(
        { success: false, error: "Solo se puede generar asiento en periodos trimestrales." },
        { status: 400 },
      )
    }

    const result = await generateFiscalLiquidationEntry({
      companyId,
      userId: session.user.id,
      modelCode: model,
      year,
      quarter,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
