import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildFiscalPanorama, fetchFiscalYearLines } from "@/lib/fiscal/panorama-service"
import { calculateTaxSummary } from "@/lib/fiscal/tax-summary"
import { FISCAL_MODEL_DEFINITIONS, calculateModelAmount, parseDetailQuarter } from "@/lib/fiscal/panorama"
import type { FiscalPeriodKey } from "@/lib/types/fiscal-panorama"

interface RouteContext {
  params: Promise<{ year: string; quarter: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { year: yearParam, quarter: quarterParam } = await params
    const { companyId } = await requireActiveCompany(request)
    const year = Number.parseInt(yearParam, 10)
    const quarter = parseDetailQuarter(quarterParam)

    if (!Number.isFinite(year) || !quarter) {
      return NextResponse.json({ success: false, error: "Periodo no válido." }, { status: 400 })
    }

    const lines = await fetchFiscalYearLines(companyId, year)
    const summary = calculateTaxSummary(lines, year, quarter)

    const periodKey: FiscalPeriodKey = quarter === "annual" ? "annual" : (`q${quarter}` as FiscalPeriodKey)

    const models = FISCAL_MODEL_DEFINITIONS.map((model) => {
      const result = calculateModelAmount(model.code, lines, year, quarter)
      const q = quarter === "annual" ? "anual" : String(quarter)
      return {
        modelCode: model.code,
        modelLabel: model.label,
        amount: result.amount,
        href: `/dashboard/fiscal/${model.code}/${year}/${q}`,
      }
    })

    const panorama = await buildFiscalPanorama(companyId, "", year)
    const breakdown = panorama.summary.breakdown?.[periodKey]

    return NextResponse.json({
      success: true,
      resumen: {
        year,
        quarter,
        periodLabel:
          quarter === "annual" ? `Resumen anual ${year}` : `${quarter}T ${year}`,
        summary: breakdown ?? summary,
        models,
        totalAPagarDevolver: summary.totalAPagarDevolver,
        resultLabel: summary.label,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
