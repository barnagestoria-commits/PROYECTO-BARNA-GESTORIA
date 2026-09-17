import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { releaseThirdPartyContact } from "@/lib/accounting/account-release-service"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { companyId } = await requireActiveCompany(request)
    const result = await releaseThirdPartyContact(companyId, id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "No se encontró el contacto." ? 404 : 400
      return NextResponse.json({ success: false, error: error.message }, { status })
    }
    return authErrorResponse(error)
  }
}
