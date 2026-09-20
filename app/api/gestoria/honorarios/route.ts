import { NextResponse } from "next/server"
import { authErrorResponse, requireCompanyAccess, requireGestoriaSession } from "@/lib/auth/api-auth"
import { listHonorariosForClient } from "@/lib/gestoria/honorarios-service"

export async function GET(request: Request) {
  try {
    const session = await requireGestoriaSession(request)
    const companyId = new URL(request.url).searchParams.get("companyId")
    const { companyId: clientCompanyId } = await requireCompanyAccess(request, companyId)
    const invoices = await listHonorariosForClient(session.user.accountId, clientCompanyId)
    return NextResponse.json({ success: true, invoices })
  } catch (error) {
    return authErrorResponse(error)
  }
}
