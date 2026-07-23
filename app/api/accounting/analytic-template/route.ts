import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { getAccountAnalyticTemplate } from "@/lib/accounting/analytic-accounting-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const accountCode = url.searchParams.get("accountCode")?.trim() ?? ""

    if (!accountCode) {
      return NextResponse.json({ success: false, error: "Indica la cuenta." }, { status: 400 })
    }

    const template = await getAccountAnalyticTemplate(companyId, accountCode)
    return NextResponse.json({ success: true, template })
  } catch (error) {
    return authErrorResponse(error)
  }
}
