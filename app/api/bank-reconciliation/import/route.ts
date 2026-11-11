import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { confirmBankStatementImport } from "@/lib/bank-reconciliation/bank-import-service"

export const runtime = "nodejs"
export const maxDuration = 120
export const dynamic = "force-dynamic"

interface ImportBody {
  companyId?: string
  storageKey?: string
  fileName?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportBody
    const { session, companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.storageKey) {
      return NextResponse.json(
        { success: false, error: "Falta la referencia del extracto en el almacén de objetos." },
        { status: 400 },
      )
    }

    const result = await confirmBankStatementImport(
      companyId,
      { storageKey: body.storageKey, fileName: body.fileName },
      session.user.id,
    )

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
