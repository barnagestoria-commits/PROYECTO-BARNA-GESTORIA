import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { finishParsedA3Import } from "@/lib/imports/a3/a3-import-service"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

interface FinishParsedBody {
  companyId?: string
  importId: string
  totals: {
    entriesCreated: number
    subaccountsCreated: number
    thirdPartiesCreated: number
    fixedAssetsCreated: number
    linesImported: number
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FinishParsedBody
    const { companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.importId?.trim()) {
      return NextResponse.json({ success: false, error: "Importación no identificada." }, { status: 400 })
    }

    if (!body.totals) {
      return NextResponse.json({ success: false, error: "Totales no proporcionados." }, { status: 400 })
    }

    const result = await finishParsedA3Import(companyId, body.importId.trim(), body.totals)

    return NextResponse.json({
      success: true,
      import: result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
