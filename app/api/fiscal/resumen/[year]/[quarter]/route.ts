import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { getEnabledModelsForCompany } from "@/lib/fiscal/fiscal-settings-service"
import { loadModel130Options } from "@/lib/fiscal/model-130-context"
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

    const [lines, enabledModels, model130] = await Promise.all([
      fetchFiscalYearLines(companyId, year),
      getEnabledModelsForCompany(companyId),
      loadModel130Options(companyId, year),
    ])
    const calculationOptions = { model130 }
    const panorama = await buildFiscalPanorama(companyId, "", year, enabledModels)
    const periodKey: FiscalPeriodKey = quarter === "annual" ? "annual" : (`q${quarter}` as FiscalPeriodKey)
    const breakdown = panorama.summary.breakdown?.[periodKey]
    const summary = calculateTaxSummary(lines, year, quarter, {}, enabledModels, calculationOptions)

    const models = FISCAL_MODEL_DEFINITIONS.filter((model) =>
      enabledModels.includes(model.code),
    ).map((model) => {
      const result = calculateModelAmount(model.code, lines, year, quarter, calculationOptions)
      const q = quarter === "annual" ? "anual" : String(quarter)
      const cell = panorama.blocks
        .flatMap((block) => block.rows)
        .find((row) => row.modelCode === model.code)?.cells[periodKey]
      return {
        modelCode: model.code,
        modelLabel: model.label,
        amount: cell?.amount ?? result.amount,
        href: `/dashboard/fiscal/${model.code}/${year}/${q}`,
      }
    })

    return NextResponse.json({
      success: true,
      resumen: {
        year,
        quarter,
        periodLabel:
          quarter === "annual" ? `Resumen anual ${year}` : `${quarter}T ${year}`,
        summary: breakdown ?? summary,
        models,
        totalAPagarDevolver: breakdown?.totalAPagarDevolver ?? summary.totalAPagarDevolver,
        resultLabel: breakdown?.resultLabel ?? summary.label,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
