import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { confirmA3ZipImport } from "@/lib/imports/a3/a3-import-service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo no proporcionado." }, { status: 400 })
    }

    const extension = file.name.toLowerCase().split(".").pop() ?? ""
    if (extension !== "zip") {
      return NextResponse.json(
        { success: false, error: "Esta ruta solo acepta archivos .zip de Wolters Kluwer." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await confirmA3ZipImport(companyId, file.name, buffer, session.user.id)

    return NextResponse.json({
      success: true,
      import: result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
