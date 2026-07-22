import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  getAccountingEntryById,
  updateAccountingEntry,
} from "@/lib/accounting/entry-service"
import type { SaveAccountingEntryInput } from "@/lib/accounting/entry-payload"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { companyId } = await requireActiveCompany(_request)
    const entry = await getAccountingEntryById(companyId, params.id)

    if (!entry) {
      return NextResponse.json({ success: false, error: "Asiento no encontrado." }, { status: 404 })
    }

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as SaveAccountingEntryInput
    const entry = await updateAccountingEntry(companyId, params.id, body)

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
