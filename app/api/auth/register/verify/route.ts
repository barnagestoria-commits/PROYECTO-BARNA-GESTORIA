import { NextResponse } from "next/server"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { confirmEmailVerification } from "@/lib/auth/service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { challengeId?: string; code?: string }
    if (!body.challengeId?.trim() || !body.code?.trim()) {
      return NextResponse.json(
        { success: false, error: "Escribe el código que te hemos enviado." },
        { status: 400 },
      )
    }
    const session = await confirmEmailVerification(body.challengeId.trim(), body.code.trim())
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
