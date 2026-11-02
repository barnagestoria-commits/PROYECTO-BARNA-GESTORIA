import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { listSiiMonth } from "@/lib/fiscal/sii/service"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const year = Number.parseInt(url.searchParams.get("year") ?? "", 10)
    const month = Number.parseInt(url.searchParams.get("month") ?? "", 10)
    if (!Number.isFinite(year) || year < 2000 || year > 2100 || month < 1 || month > 12) {
      return NextResponse.json({ success: false, error: "Indica un año y un mes válidos." }, { status: 400 })
    }

    const books = await listSiiMonth(companyId, year, month)
    if (!books) {
      return NextResponse.json(
        { success: false, error: "Esta empresa no tiene el SII marcado en su ficha." },
        { status: 403 },
      )
    }

    return NextResponse.json({ success: true, ...books })
  } catch (error) {
    return authErrorResponse(error)
  }
}
