import { NextResponse } from "next/server"
import type { RegisterRequest } from "@/lib/types/auth"
import { registerAccount } from "@/lib/auth/service"
import { authErrorResponse } from "@/lib/auth/api-auth"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest

    if (!body.name || !body.email || !body.password || !body.accountType || !body.companyName) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios." },
        { status: 400 },
      )
    }

    if (body.password.length < 6) {
      return NextResponse.json(
        { success: false, error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 },
      )
    }

    const session = await registerAccount(body)
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
