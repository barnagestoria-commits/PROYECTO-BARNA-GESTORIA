import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { importAccountingCsv } from "@/lib/imports/accounting-csv"

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const content = await file.text()
    const result = await importAccountingCsv(companyId, file.name, content, session.user.id)

    return NextResponse.json({ success: true, import: result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
