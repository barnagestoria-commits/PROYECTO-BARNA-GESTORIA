import { NextResponse } from "next/server"
import { authErrorResponse, requireGestoriaAdmin } from "@/lib/auth/api-auth"
import { removeGestoriaTechnician, updateGestoriaTechnicianAccess } from "@/lib/gestoria/team-service"

interface RouteContext {
  params: Promise<{ userId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireGestoriaAdmin(request)
    const { userId } = await context.params
    const body = (await request.json()) as { companyIds?: string[] }

    const member = await updateGestoriaTechnicianAccess(
      session.user.accountId,
      session.user.role,
      userId,
      Array.isArray(body.companyIds) ? body.companyIds : [],
    )

    return NextResponse.json({ success: true, member })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireGestoriaAdmin(request)
    const { userId } = await context.params
    await removeGestoriaTechnician(session.user.accountId, session.user.id, session.user.role, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
