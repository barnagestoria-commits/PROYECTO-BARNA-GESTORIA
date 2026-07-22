import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { fetchAccountMovements } from "@/lib/accounting/account-movements-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const cuenta = url.searchParams.get("cuenta")?.trim() ?? ""
    const yearParam = url.searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()

    if (!cuenta) {
      return NextResponse.json({ success: false, error: "Indica la cuenta contable." }, { status: 400 })
    }

    const summary = await fetchAccountMovements(companyId, cuenta, year)

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
