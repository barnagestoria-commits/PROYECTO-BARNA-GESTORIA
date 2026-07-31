import { NextResponse } from "next/server"
import { authErrorResponse, requireGestoriaSession } from "@/lib/auth/api-auth"
import { previewPortfolioImport } from "@/lib/imports/portfolio/portfolio-import-service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireGestoriaSession(request)
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const preview = await previewPortfolioImport(
      session.user.accountId,
      session.user.id,
      file.name,
      buffer,
    )

    return NextResponse.json({
      success: true,
      preview: {
        fileName: preview.fileName,
        sourceType: preview.sourceType,
        newCount: preview.newCount,
        existingCount: preview.existingCount,
        skippedCount: preview.skippedCount,
        accountingEntryCount: preview.accountingEntryCount,
        newWithAccountingCount: preview.newWithAccountingCount,
        warnings: preview.warnings,
        candidates: preview.candidates.map((item) => ({
          clientCode: item.clientCode,
          name: item.name,
          cif: item.cif,
          entityType: item.entityType,
          source: item.source,
          status: item.status,
          existingCompanyName: item.existingCompanyName,
          skipReason: item.skipReason,
          entryCount: item.entryCount,
          hasAccountingData: item.hasAccountingData,
        })),
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
