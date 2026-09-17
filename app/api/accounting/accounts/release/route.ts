import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { releaseCompanyAccount } from "@/lib/accounting/account-release-service"

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as { accountCode?: string }

    if (!body.accountCode?.trim()) {
      return NextResponse.json(
        { success: false, error: "Indica la cuenta que quieres dejar libre." },
        { status: 400 },
      )
    }

    const account = await releaseCompanyAccount(companyId, body.accountCode)
    return NextResponse.json({ success: true, account })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
