import { NextResponse } from "next/server"
import {
  authErrorResponse,
  resolveImportCompanyFromBody,
  resolveImportCompanyFromQuery,
} from "@/lib/auth/api-auth"
import {
  deleteAllAccountingEntries,
  getCompanyAccountingVolume,
} from "@/lib/accounting/entry-service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { companyId } = await resolveImportCompanyFromQuery(request, searchParams)
    const volume = await getCompanyAccountingVolume(companyId)

    return NextResponse.json({ success: true, volume })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { companyId?: string; confirm?: boolean }
    const { companyId } = await resolveImportCompanyFromBody(request, body)

    if (body.confirm !== true) {
      return NextResponse.json(
        { success: false, error: "Confirmación requerida para borrar la contabilidad." },
        { status: 400 },
      )
    }

    const result = await deleteAllAccountingEntries(companyId)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
