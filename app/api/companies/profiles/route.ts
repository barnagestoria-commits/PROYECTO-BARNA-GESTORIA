import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import { listGestoriaClientProfiles } from "@/lib/contabilidad/gestoria-client-service"

export async function GET(request: Request) {
  try {
    const session = await requireRequestSession(request)

    if (session.user.accountType !== "GESTORIA") {
      return NextResponse.json({ success: false, error: "Acceso denegado." }, { status: 403 })
    }

    const profiles = await listGestoriaClientProfiles(
      session.user.accountId,
      session.user.id,
    )

    return NextResponse.json({
      success: true,
      profiles: Object.fromEntries(profiles),
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
