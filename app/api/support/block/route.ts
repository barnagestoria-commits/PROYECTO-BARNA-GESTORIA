import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { setUserAccessBlock } from "@/lib/auth/service"

export async function POST(request: Request) {
  try {
    const session = await requirePlatformOperator(request)
    const body = (await request.json()) as { userId?: string; blocked?: boolean; reason?: string }
    if (!body.userId?.trim() || typeof body.blocked !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Indica el usuario y si queda bloqueado." },
        { status: 400 },
      )
    }

    await setUserAccessBlock({
      operatorUserId: session.user.id,
      userId: body.userId.trim(),
      blocked: body.blocked,
      reason: body.reason,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return authErrorResponse(error)
  }
}
