import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { autoReconcileBankMovements } from "@/lib/bank-reconciliation/reconciliation-service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { companyId?: string }
    const { session, companyId } = await resolveImportCompanyFromBody(request, body)
    const result = await autoReconcileBankMovements(companyId, session.user.id)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
