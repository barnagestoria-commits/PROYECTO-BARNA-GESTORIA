import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildReportMeta, fetchCompanyChartExtract } from "@/lib/reports/account-ledger"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const yearParam = url.searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()

    const [meta, extract] = await Promise.all([
      buildReportMeta(companyId, "Extracto de cuentas", year),
      fetchCompanyChartExtract({ companyId, year }),
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
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
