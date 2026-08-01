import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromQuery } from "@/lib/auth/api-auth"
import { getBankReconciliationSummary } from "@/lib/bank-reconciliation/reconciliation-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const { companyId } = await resolveImportCompanyFromQuery(request, url.searchParams)
    const summary = await getBankReconciliationSummary(companyId)

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
