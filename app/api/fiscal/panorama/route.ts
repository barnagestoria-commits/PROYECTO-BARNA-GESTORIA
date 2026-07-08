import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildFiscalPanorama } from "@/lib/fiscal/panorama-service"

export async function GET(request: Request) {
  try {
    const { companyId, session } = await requireActiveCompany(request)
    const { searchParams } = new URL(request.url)

    const yearParam = searchParams.get("year")
    const year = yearParam ? Number.parseInt(yearParam, 10) : new Date().getFullYear()

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Año no válido." }, { status: 400 })
    }

    const company = session.companies.find((item) => item.id === companyId)
    const panorama = await buildFiscalPanorama(companyId, company?.name ?? "Empresa", year)

    return NextResponse.json({ success: true, panorama })
  } catch (error) {
    return authErrorResponse(error)
  }
}
