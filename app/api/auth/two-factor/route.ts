import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import { verifyPassword } from "@/lib/auth/password"
import { prisma } from "@/lib/db"
import {
  disableEmailTwoFactor,
  enableEmailTwoFactor,
  sendTwoFactorSetupCode,
} from "@/lib/auth/two-factor-login"

export async function POST(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const body = (await request.json()) as { action?: string; code?: string; password?: string }

    if (body.action === "send") {
      await sendTwoFactorSetupCode(session.user.id)
      return NextResponse.json({ success: true })
    }

    if (body.action === "enable") {
      if (!body.code?.trim()) {
        return NextResponse.json({ success: false, error: "Escribe el código del correo." }, { status: 400 })
      }
      await enableEmailTwoFactor(session.user.id, body.code.trim())
      return NextResponse.json({ success: true })
    }

    if (body.action === "disable") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      })
      if (!body.password || !user || !verifyPassword(body.password, user.passwordHash)) {
        return NextResponse.json(
          { success: false, error: "Confirma tu contraseña para quitar la verificación." },
          { status: 400 },
        )
      }
      await disableEmailTwoFactor(session.user.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: "No reconocemos esa acción." }, { status: 400 })
  } catch (error) {
    return authErrorResponse(error)
  }
}
