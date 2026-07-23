import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { AuthSession } from "@/lib/types/auth"
import { SESSION_COOKIE, getSessionFromToken } from "@/lib/auth/service"

export const SESSION_HEADER = "x-session-token"

export async function getRequestSession(_request: Request): Promise<AuthSession | null> {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value
  return getSessionFromToken(cookieToken)
}

export async function requireRequestSession(request: Request): Promise<AuthSession> {
  const session = await getRequestSession(request)
  if (!session) {
    throw new AuthApiError("No autenticado.", 401)
  }
  return session
}

export async function requireActiveCompany(request: Request): Promise<{
  session: AuthSession
  companyId: string
}> {
  const session = await requireRequestSession(request)
  const companyId = session.activeCompanyId

  if (!companyId) {
    throw new AuthApiError("No hay empresa activa seleccionada.", 400)
  }

  if (!session.companies.some((company) => company.id === companyId)) {
    throw new AuthApiError("No tienes acceso a la empresa activa.", 403)
  }

  return { session, companyId }
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = "AuthApiError"
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthApiError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof Error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
  return NextResponse.json({ success: false, error: "Error de autenticación." }, { status: 500 })
}
