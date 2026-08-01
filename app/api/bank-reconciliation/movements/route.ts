import { NextResponse } from "next/server"
import type { BankMovementStatus } from "@prisma/client"
import { authErrorResponse, resolveImportCompanyFromQuery } from "@/lib/auth/api-auth"
import { listBankMovements } from "@/lib/bank-reconciliation/reconciliation-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const { companyId } = await resolveImportCompanyFromQuery(request, url.searchParams)
    const statusParam = url.searchParams.get("status")?.toUpperCase()
    const status =
      statusParam === "PENDIENTE" || statusParam === "CONCILIADO" || statusParam === "IGNORADO"
        ? (statusParam as BankMovementStatus)
        : undefined

    const movements = await listBankMovements(companyId, status)

    return NextResponse.json({
      success: true,
      movements,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
