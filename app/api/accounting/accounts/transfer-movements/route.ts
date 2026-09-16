import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { transferAccountMovements } from "@/lib/accounting/account-transfer-service"

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      fromAccountCode?: string
      toAccountCode?: string
      lineIds?: string[]
    }

    const result = await transferAccountMovements(companyId, {
      fromAccountCode: body.fromAccountCode ?? "",
      toAccountCode: body.toAccountCode ?? "",
      lineIds: Array.isArray(body.lineIds) ? body.lineIds : [],
    })

    return NextResponse.json({ success: true, transfer: result })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
