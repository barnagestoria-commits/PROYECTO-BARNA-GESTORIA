import { NextResponse } from "next/server"
import { authErrorResponse, requireGestoriaSession } from "@/lib/auth/api-auth"
import { confirmPortfolioImport } from "@/lib/imports/portfolio/portfolio-import-service"

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
    const result = await confirmPortfolioImport(
      session.user.accountId,
      session.user.id,
      file.name,
      buffer,
    )

    return NextResponse.json({ success: true, import: result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
