import { NextResponse } from "next/server"
import type { AmortizationPeriodization } from "@prisma/client"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { getAmortizationSettings, updateAmortizationSettings } from "@/lib/fixed-assets/service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const settings = await getAmortizationSettings(companyId)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = await request.json()
    const periodization = body.periodization as AmortizationPeriodization
    if (!["MENSUAL", "TRIMESTRAL", "ANUAL"].includes(periodization)) {
      return NextResponse.json({ success: false, error: "Periodización no válida." }, { status: 400 })
    }
    const settings = await updateAmortizationSettings(companyId, periodization)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}
