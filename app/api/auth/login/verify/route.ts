import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { DEVICE_COOKIE, TRUSTED_DEVICE_DAYS } from "@/lib/auth/email-two-factor"
import { establishUserSession } from "@/lib/auth/service"
import { verifyEmailChallenge } from "@/lib/auth/two-factor-login"
import { getSessionCookieOptions } from "@/lib/auth/session-cookie"
import { env } from "@/lib/config/env"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      challengeId?: string
      code?: string
      rememberDevice?: boolean
    }
    if (!body.challengeId?.trim() || !body.code?.trim()) {
      return NextResponse.json(
        { success: false, error: "Escribe el código que te hemos enviado." },
        { status: 400 },
      )
    }

    const verified = await verifyEmailChallenge({
      challengeId: body.challengeId.trim(),
      code: body.code.trim(),
      rememberDevice: Boolean(body.rememberDevice),
    })
    const session = await establishUserSession(verified.userId)
    if (verified.deviceToken) {
      const expires = new Date()
      expires.setDate(expires.getDate() + TRUSTED_DEVICE_DAYS)
      ;(await cookies()).set(DEVICE_COOKIE, verified.deviceToken, {
        ...getSessionCookieOptions(expires),
        secure: env.isProduction,
      })
    }
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
