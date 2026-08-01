import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompany } from "@/lib/auth/api-auth"
import { previewA3ZipImport } from "@/lib/imports/a3/a3-import-service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const { companyId } = await resolveImportCompany(request, formData)
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const extension = file.name.toLowerCase().split(".").pop() ?? ""
    if (extension !== "zip") {
      return NextResponse.json(
        { success: false, error: "Esta ruta solo acepta archivos .zip con contabilidad." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const preview = await previewA3ZipImport(companyId, file.name, buffer)

    return NextResponse.json({
      success: true,
      preview: {
        versionLabel: preview.versionLabel,
        companyCode: preview.companyCode,
        fiscalYear: preview.fiscalYear,
        entryCount: preview.entryCount,
        subaccountCount: preview.subaccountCount,
        newSubaccountCount: preview.newSubaccountCount,
        thirdPartyCount: preview.thirdPartyCount,
        newThirdPartyCount: preview.newThirdPartyCount,
        recordTypes: preview.recordTypes,
        contents: preview.contents,
        warnings: preview.warnings,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
