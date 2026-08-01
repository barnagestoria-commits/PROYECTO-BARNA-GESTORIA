import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { matchBankMovement } from "@/lib/bank-reconciliation/reconciliation-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyId?: string
      movementId?: string
      entryLineId?: string
    }
    const { session, companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.movementId || !body.entryLineId) {
      return NextResponse.json({ success: false, error: "Datos incompletos." }, { status: 400 })
    }

    const movement = await matchBankMovement(
      companyId,
      body.movementId,
      body.entryLineId,
      session.user.id,
    )

    return NextResponse.json({ success: true, movement })
  } catch (error) {
    return authErrorResponse(error)
  }
}
