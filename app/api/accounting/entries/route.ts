import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { DuplicateInvoiceError } from "@/lib/accounting/duplicate-invoice"
import { createAccountingEntry } from "@/lib/accounting/entry-service"
import type { SaveAccountingEntryInput } from "@/lib/accounting/entry-payload"

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as SaveAccountingEntryInput
    const entry = await createAccountingEntry(companyId, session.user.id, body)

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    if (error instanceof DuplicateInvoiceError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          duplicate: error.duplicate,
        },
        { status: 409 },
      )
    }
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
