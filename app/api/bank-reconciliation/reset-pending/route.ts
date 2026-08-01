import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { resetBankMovementToPending } from "@/lib/bank-reconciliation/reconciliation-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { companyId?: string; movementId?: string }
    const { companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.movementId) {
      return NextResponse.json({ success: false, error: "Movimiento no indicado." }, { status: 400 })
    }

    const movement = await resetBankMovementToPending(companyId, body.movementId)
    return NextResponse.json({ success: true, movement })
  } catch (error) {
    return authErrorResponse(error)
  }
}
