import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildReportMeta,
  fetchAccountBalances,
} from "@/lib/reports/account-ledger"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const yearParam = url.searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()

    const [meta, rows] = await Promise.all([
      buildReportMeta(companyId, "Extracto de cuentas", year),
      fetchAccountBalances({ companyId, year }),
    ])

    const totalDebe = rows.reduce((sum, row) => sum + row.totalDebe, 0)
    const totalHaber = rows.reduce((sum, row) => sum + row.totalHaber, 0)

    return NextResponse.json({
      success: true,
      extract: {
        meta,
        rows,
        totalDebe: Math.round(totalDebe * 100) / 100,
        totalHaber: Math.round(totalHaber * 100) / 100,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
