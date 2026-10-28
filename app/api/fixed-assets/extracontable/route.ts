import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildExtracontableReport } from "@/lib/fixed-assets/extracontable"
import { loadModel202Options } from "@/lib/fiscal/model-202-context"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const yearParam = new URL(request.url).searchParams.get("year")
    const year = Number.parseInt(yearParam ?? "", 10)
    if (!Number.isFinite(year)) {
      return NextResponse.json({ success: false, error: "Ejercicio no válido." }, { status: 400 })
    }

    const options = await loadModel202Options(companyId)
    const report = buildExtracontableReport(options.assets ?? [], year, options.taxRate)

    return NextResponse.json({
      success: true,
      year,
      taxRate: options.taxRate,
      report,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
