import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildFinancialDashboardData,
} from "@/lib/dashboard/financial-dashboard-service"
import type { DateRangeKey } from "@/lib/dashboard/financial-dashboard-data"

const VALID_RANGES = new Set<DateRangeKey>(["this_month", "last_quarter", "this_year"])

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const rangeParam = url.searchParams.get("range") ?? "this_month"

    if (!VALID_RANGES.has(rangeParam as DateRangeKey)) {
      return NextResponse.json({ success: false, error: "Rango no válido." }, { status: 400 })
    }

    const data = await buildFinancialDashboardData(companyId, rangeParam as DateRangeKey)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return authErrorResponse(error)
  }
}
