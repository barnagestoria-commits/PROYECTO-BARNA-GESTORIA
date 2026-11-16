import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { confirmOperatorPassword } from "@/lib/auth/operator-password"

export async function POST(request: Request) {
  try {
    const session = await requirePlatformOperator(request)
    const body = (await request.json()) as { challengeId?: string; code?: string; password?: string }
    if (!body.challengeId?.trim() || !body.code?.trim() || !body.password) {
      return NextResponse.json(
        { success: false, error: "Escribe el código y la contraseña nueva." },
        { status: 400 },
      )
    }
    await confirmOperatorPassword({
      userId: session.user.id,
      challengeId: body.challengeId.trim(),
      code: body.code.trim(),
      password: body.password,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error)
  }
}
