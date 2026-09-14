import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import { buildReportMeta, fetchCompanyChartExtract } from "@/lib/reports/account-ledger"

const DETAIL_LEVELS = new Set<GestoriaAccountDetailLevel>(["NIVEL_3", "NIVEL_4", "SUBCUENTAS"])

function parseDetailLevel(value: string | null): GestoriaAccountDetailLevel {
  if (value && DETAIL_LEVELS.has(value as GestoriaAccountDetailLevel)) {
    return value as GestoriaAccountDetailLevel
  }
  return "SUBCUENTAS"
}

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const yearParam = url.searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()
    const detailLevel = parseDetailLevel(url.searchParams.get("detail"))

    const [meta, extract] = await Promise.all([
      buildReportMeta(companyId, "Extracto de cuentas", year),
      fetchCompanyChartExtract({ companyId, year }, detailLevel),
    ])

    return NextResponse.json({
      success: true,
      extract: {
        meta,
        plan: extract.plan,
        rows: extract.rows,
        totalDebe: extract.totalDebe,
        totalHaber: extract.totalHaber,
        accountsWithMovement: extract.accountsWithMovement,
        detailLevel: extract.detailLevel,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
