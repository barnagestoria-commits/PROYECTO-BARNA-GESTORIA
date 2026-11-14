import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { LoginRequest } from "@/lib/types/auth"
import { loginAccount } from "@/lib/auth/service"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { DEVICE_COOKIE } from "@/lib/auth/email-two-factor"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest

    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: "Email y contraseña son obligatorios." },
        { status: 400 },
      )
    }

    const deviceToken = (await cookies()).get(DEVICE_COOKIE)?.value
    const result = await loginAccount(body.email, body.password, deviceToken)
    if (result.twoFactorRequired) {
      return NextResponse.json({
        success: true,
        twoFactorRequired: true,
        challengeId: result.challengeId,
      })
    }
    return NextResponse.json({ success: true, session: result.session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
