import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import {
  deleteOwnAccount,
  logoutAccount,
  pauseOwnSubscription,
  resumeOwnSubscription,
} from "@/lib/auth/service"

export async function POST(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const body = (await request.json()) as { mode?: string }

    if (body.mode === "pause") {
      const updated = await pauseOwnSubscription(session)
      return NextResponse.json({ success: true, session: updated })
    }

    if (body.mode === "resume") {
      const updated = await resumeOwnSubscription(session)
      return NextResponse.json({ success: true, session: updated })
    }

    if (body.mode === "delete") {
      await deleteOwnAccount(session)
      await logoutAccount()
      return NextResponse.json({ success: true, deleted: true })
    }

    return NextResponse.json(
      { success: false, error: "Indica si quieres pausar la suscripción o eliminar la cuenta." },
      { status: 400 },
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}
