import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompany } from "@/lib/auth/api-auth"
import {
  stageBankStatementImport,
  toBankPreviewClientPayload,
} from "@/lib/bank-reconciliation/bank-import-service"

export const runtime = "nodejs"
export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const { companyId } = await resolveImportCompany(request, formData)
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const staged = await stageBankStatementImport({
      companyId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    })

    return NextResponse.json({
      success: true,
      preview: toBankPreviewClientPayload(staged.stored, staged.preview),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
