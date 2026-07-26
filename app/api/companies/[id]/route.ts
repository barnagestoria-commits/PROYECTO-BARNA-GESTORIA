import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import {
  deleteGestoriaClientCompany,
  getGestoriaClientDetail,
  updateGestoriaClientCompany,
  type UpdateGestoriaClientInput,
} from "@/lib/contabilidad/gestoria-client-service"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireRequestSession(request)
    const { id } = await context.params

    if (session.user.accountType !== "GESTORIA") {
      return NextResponse.json({ success: false, error: "Acceso denegado." }, { status: 403 })
    }

    const detail = await getGestoriaClientDetail(id, session.user.accountId, session.user.id)
    return NextResponse.json({ success: true, client: detail })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireRequestSession(request)
    const { id } = await context.params

    if (session.user.accountType !== "GESTORIA") {
      return NextResponse.json({ success: false, error: "Acceso denegado." }, { status: 403 })
    }

    const body = (await request.json()) as UpdateGestoriaClientInput
    const client = await updateGestoriaClientCompany(
      id,
      session.user.accountId,
      session.user.id,
      body,
    )

    return NextResponse.json({ success: true, client })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireRequestSession(request)
    const { id } = await context.params

    if (session.user.accountType !== "GESTORIA") {
      return NextResponse.json({ success: false, error: "Acceso denegado." }, { status: 403 })
    }

    await deleteGestoriaClientCompany(id, session.user.accountId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
