import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildFiscalModelDetail,
  isValidModelCode,
} from "@/lib/fiscal/panorama-service"
import { parseDetailQuarter } from "@/lib/fiscal/panorama"

interface RouteContext {
  params: { model: string; year: string; quarter: string }
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { companyId } = await requireActiveCompany(request)

    if (!isValidModelCode(params.model)) {
      return NextResponse.json({ success: false, error: "Modelo fiscal no válido." }, { status: 400 })
    }

    const year = Number.parseInt(params.year, 10)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Año no válido." }, { status: 400 })
    }

    const quarter = parseDetailQuarter(params.quarter)
    if (!quarter) {
      return NextResponse.json({ success: false, error: "Trimestre no válido." }, { status: 400 })
    }

    const detail = await buildFiscalModelDetail(companyId, params.model, year, quarter)
    if (!detail) {
      return NextResponse.json({ success: false, error: "Modelo no encontrado." }, { status: 404 })
    }

    return NextResponse.json({ success: true, detail })
  } catch (error) {
    return authErrorResponse(error)
  }
}
