import { NextResponse } from "next/server"
import type { AccountType, RegisterRequest } from "@/lib/types/auth"
import { registerAccount } from "@/lib/auth/service"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { consumeRegistrationAttempt } from "@/lib/auth/login-guard"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest

    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "desconocida"
    try {
      await consumeRegistrationAttempt(ip)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Demasiados intentos." },
        { status: 429 },
      )
    }

    if (!body.name || !body.email || !body.password || !body.accountType || !body.companyName) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios." },
        { status: 400 },
      )
    }

    const validAccountTypes: AccountType[] = ["GESTORIA", "CLIENTE_FINAL", "EMPRESA"]
    if (!validAccountTypes.includes(body.accountType)) {
      return NextResponse.json(
        { success: false, error: "Tipo de cuenta no válido." },
        { status: 400 },
      )
    }

    if (body.password.length < 8) {
      return NextResponse.json(
        { success: false, error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 },
      )
    }

    if (body.acceptTerms !== true) {
      return NextResponse.json(
        { success: false, error: "Debes aceptar los Términos del servicio y la Política de privacidad." },
        { status: 400 },
      )
    }

    const session = await registerAccount(body)
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
