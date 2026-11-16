import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { sendOperatorPasswordCode } from "@/lib/auth/operator-password"

export async function POST(request: Request) {
  try {
    const session = await requirePlatformOperator(request)
    const pending = await sendOperatorPasswordCode({
      id: session.user.id,
      email: session.user.email,
    })
    return NextResponse.json({ success: true, challengeId: pending.challengeId })
  } catch (error) {
    return authErrorResponse(error)
  }
}
