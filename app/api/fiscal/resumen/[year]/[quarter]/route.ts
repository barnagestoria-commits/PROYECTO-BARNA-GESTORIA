import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildFiscalPanorama } from "@/lib/fiscal/panorama-service"
import { calculateTaxSummary, periodKeyToQuarter } from "@/lib/fiscal/tax-summary"
import { FISCAL_MODEL_DEFINITIONS } from "@/lib/fiscal/panorama"
import { calculateModelAmount } from "@/lib/fiscal/panorama"
import { prisma } from "@/lib/db"
import { parseDetailQuarter } from "@/lib/fiscal/panorama"
import type { FiscalPeriodKey } from "@/lib/types/fiscal-panorama"

interface RouteContext {
  params: Promise<{ year: string; quarter: string }>
}

async function fetchYearLines(companyId: string, year: number) {
  const start = new Date(`${year}-01-01T00:00:00.000Z`)
  const end = new Date(`${year}-12-31T23:59:59.999Z`)
  return prisma.entryLine.findMany({
    where: { entry: { companyId, fecha: { gte: start, lte: end } } },
    include: { entry: { select: { id: true, fecha: true } } },
    orderBy: [{ entry: { fecha: "asc" } }, { sortOrder: "asc" }],
  })
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

    const lines = await fetchYearLines(companyId, year)
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
