import { NextResponse } from "next/server"
import { buildMockCertificate } from "@/lib/settings/certificate-storage"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body?.fileName || !body?.password || !body?.environment) {
    return NextResponse.json(
      { error: "Indica archivo, contraseña y entorno del certificado." },
      { status: 400 },
    )
  }

  if (!String(body.fileName).match(/\.(p12|pfx)$/i)) {
    return NextResponse.json(
      { error: "El certificado debe ser un archivo .p12 o .pfx." },
      { status: 400 },
    )
  }

  if (String(body.password).length < 4) {
    return NextResponse.json(
      { error: "La contraseña del certificado parece demasiado corta." },
      { status: 400 },
    )
  }

  const certificate = buildMockCertificate({
    fileName: String(body.fileName),
    password: String(body.password),
    environment: body.environment === "production" ? "production" : "sandbox",
  })

  return NextResponse.json({
    success: true,
    certificate,
    message: "Certificado recibido y encriptado (simulación).",
  })
}
