import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { checkAccountExists } from "@/lib/accounting/account-exists-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const code = url.searchParams.get("code")?.trim() ?? ""
    const yearParam = url.searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()

    if (!code) {
      return NextResponse.json({ success: false, error: "Indica el código de cuenta." }, { status: 400 })
    }

    const result = await checkAccountExists(companyId, code)

    return NextResponse.json({
      success: true,
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
      ...result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
