import { NextResponse } from "next/server"
import { AuthApiError, authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { submitSiiMonth } from "@/lib/fiscal/sii/service"
import type { SiiBook } from "@/lib/fiscal/sii/types"

export const runtime = "nodejs"

function decodePfx(fileBase64: string): Buffer {
  const normalized = fileBase64.includes(",") ? fileBase64.split(",").pop() ?? "" : fileBase64
  return Buffer.from(normalized, "base64")
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json().catch(() => null)) as {
      year?: number
      month?: number
      book?: SiiBook
      environment?: string
      fileBase64?: string
      password?: string
    } | null

    const year = Number(body?.year)
    const month = Number(body?.month)
    const book = body?.book
    if (!Number.isFinite(year) || month < 1 || month > 12 || (book !== "EMITIDAS" && book !== "RECIBIDAS")) {
      return NextResponse.json({ success: false, error: "Indica el mes y el libro a enviar." }, { status: 400 })
    }
    if (!body?.fileBase64 || !body.password) {
      return NextResponse.json(
        { success: false, error: "Adjunta el certificado .p12 de la empresa y su contraseña." },
        { status: 400 },
      )
    }

    const pfx = decodePfx(body.fileBase64)
    if (pfx.length === 0) {
      return NextResponse.json({ success: false, error: "El certificado está vacío." }, { status: 400 })
    }

    const result = await submitSiiMonth({
      companyId,
      year,
      month,
      book,
      environment: body.environment === "production" ? "production" : "sandbox",
      pfx,
      passphrase: body.password,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AuthApiError) return authErrorResponse(error)
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
