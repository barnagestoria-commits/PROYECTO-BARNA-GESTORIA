import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"

/**
 * La prueba de firma contra el sandbox de la AEAT todavía no está conectada.
 * Antes devolvía un "éxito" simulado; ahora responde con honestidad para no
 * hacer creer al usuario que su certificado ha sido validado.
 */
export async function POST(request: Request) {
  try {
    await requireRequestSession(request)
    return NextResponse.json(
      {
        success: false,
        error:
          "La prueba de firma con el entorno de pruebas de la AEAT aún no está disponible. Tu certificado queda guardado, pero no se ha validado.",
      },
      { status: 501 },
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}
