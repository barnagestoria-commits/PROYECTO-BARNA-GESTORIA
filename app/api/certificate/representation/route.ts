import { NextResponse } from "next/server"
import { authErrorResponse, requireGestoriaAdmin, requireGestoriaSession } from "@/lib/auth/api-auth"
import {
  deleteGestoriaRepresentationCertificate,
  getGestoriaRepresentationCertificate,
  saveGestoriaRepresentationCertificate,
} from "@/lib/certificate/certificate-service"
import type { VerifactuEnvironment } from "@/lib/settings/certificate-storage"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await requireGestoriaSession(request)
    const certificate = await getGestoriaRepresentationCertificate(session.user.accountId)
    return NextResponse.json({ success: true, certificate })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireGestoriaAdmin(request)
    await deleteGestoriaRepresentationCertificate(session.user.accountId)
    return NextResponse.json({
      success: true,
      message: "Certificado de representación eliminado correctamente.",
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGestoriaAdmin(request)
    const body = await request.json().catch(() => null)

    if (!body?.fileName || !body?.password || !body?.environment || !body?.fileBase64) {
      return NextResponse.json(
        { success: false, error: "Indica archivo, contraseña y entorno del certificado." },
        { status: 400 },
      )
    }

    if (!String(body.fileName).match(/\.(p12|pfx)$/i)) {
      return NextResponse.json(
        { success: false, error: "El certificado debe ser un archivo .p12 o .pfx." },
        { status: 400 },
      )
    }

    if (String(body.password).length < 4) {
      return NextResponse.json(
        { success: false, error: "La contraseña del certificado parece demasiado corta." },
        { status: 400 },
      )
    }

    const environment: VerifactuEnvironment =
      body.environment === "production" ? "production" : "sandbox"

    const certificate = await saveGestoriaRepresentationCertificate(session.user.accountId, {
      fileName: String(body.fileName),
      password: String(body.password),
      environment,
      fileBase64: String(body.fileBase64),
    })

    return NextResponse.json({
      success: true,
      certificate,
      message: "Certificado de representación guardado. Los técnicos podrán presentar impuestos de la cartera.",
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
