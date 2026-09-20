import { NextResponse } from "next/server"
import { authErrorResponse, requireGestoriaAdmin, requireGestoriaSession } from "@/lib/auth/api-auth"
import { inviteGestoriaTechnician, listGestoriaTeam } from "@/lib/gestoria/team-service"

export async function GET(request: Request) {
  try {
    const session = await requireGestoriaSession(request)
    if (session.user.role !== "ADMIN_GESTOR") {
      return NextResponse.json({ success: false, error: "Acceso denegado." }, { status: 403 })
    }
    const team = await listGestoriaTeam(session.user.accountId)
    return NextResponse.json({ success: true, team })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGestoriaAdmin(request)
    const body = (await request.json()) as {
      name?: string
      email?: string
      password?: string
      companyIds?: string[]
    }

    const member = await inviteGestoriaTechnician(session.user.accountId, session.user.role, {
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      companyIds: Array.isArray(body.companyIds) ? body.companyIds : [],
    })

    return NextResponse.json({ success: true, member })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
