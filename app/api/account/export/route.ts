import { NextResponse } from "next/server"
import { AuthApiError, authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import { canCloseOwnAccount } from "@/lib/auth/account-closure"
import { createAccountExportStream } from "@/lib/account-export/build-account-export"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Descarga de todos los datos de la cuenta (ZIP). Disponible siempre, también en solo lectura
 * y en el periodo previo al borrado: la cuenta es del cliente y se la puede llevar.
 */
export async function GET(request: Request) {
  try {
    const session = await requireRequestSession(request)
    if (!canCloseOwnAccount(session.user.role)) {
      throw new AuthApiError("Solo quien administra la cuenta puede descargar todos sus datos.", 403)
    }

    const stream = await createAccountExportStream(session.user.accountId)
    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="taxlyn-datos-${stamp}.zip"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
