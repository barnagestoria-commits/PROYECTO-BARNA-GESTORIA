import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromQuery } from "@/lib/auth/api-auth"
import { findReconciliationCandidates } from "@/lib/bank-reconciliation/reconciliation-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const { companyId } = await resolveImportCompanyFromQuery(request, url.searchParams)
    const movementId = url.searchParams.get("movementId")?.trim()

    if (!movementId) {
      return NextResponse.json({ success: false, error: "Movimiento no indicado." }, { status: 400 })
    }

    const candidates = await findReconciliationCandidates(companyId, movementId)

    return NextResponse.json({
      success: true,
      candidates,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
