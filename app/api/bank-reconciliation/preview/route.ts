import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompany } from "@/lib/auth/api-auth"
import { previewBankStatementImport } from "@/lib/bank-reconciliation/bank-import-service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    await resolveImportCompany(request, formData)
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const preview = await previewBankStatementImport(buffer, file.name, file.type || "application/octet-stream")

    return NextResponse.json({
      success: true,
      preview: {
        fileName: preview.fileName,
        source: preview.source,
        movementCount: preview.movements.length,
        warnings: preview.warnings,
        sample: preview.movements.slice(0, 5),
        movements: preview.movements,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
