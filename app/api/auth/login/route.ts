import { NextResponse } from "next/server"
import type { LoginRequest } from "@/lib/types/auth"
import { loginAccount } from "@/lib/auth/service"
import { authErrorResponse } from "@/lib/auth/api-auth"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest

    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: "Email y contraseña son obligatorios." },
        { status: 400 },
      )
    }

    const session = await loginAccount(body.email, body.password)
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
