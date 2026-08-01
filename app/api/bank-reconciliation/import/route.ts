import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { confirmBankStatementImport } from "@/lib/bank-reconciliation/bank-import-service"
import type { BankImportPreview } from "@/lib/bank-reconciliation/types"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

interface ImportBody {
  companyId?: string
  preview: BankImportPreview
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportBody
    const { session, companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.preview?.movements?.length) {
      return NextResponse.json({ success: false, error: "No hay movimientos para importar." }, { status: 400 })
    }

    const result = await confirmBankStatementImport(companyId, body.preview, session.user.id)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
