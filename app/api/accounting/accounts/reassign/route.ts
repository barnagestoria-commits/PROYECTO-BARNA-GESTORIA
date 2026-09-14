import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { reassignCompanyAccount } from "@/lib/accounting/account-reassign-service"

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as {
      fromAccountCode?: string
      toAccountCode?: string
      name?: string
    }

    if (!body.fromAccountCode?.trim() || !body.toAccountCode?.trim()) {
      return NextResponse.json(
        { success: false, error: "Indica la cuenta actual y la nueva." },
        { status: 400 },
      )
    }

    const account = await reassignCompanyAccount(companyId, {
      fromAccountCode: body.fromAccountCode,
      toAccountCode: body.toAccountCode,
      name: body.name,
    })

    return NextResponse.json({ success: true, account })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
