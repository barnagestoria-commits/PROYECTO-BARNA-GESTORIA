import { NextResponse } from "next/server"
import { setActiveCompany } from "@/lib/auth/service"
import { authErrorResponse } from "@/lib/auth/api-auth"

export async function PATCH(request: Request) {
  try {
    const { companyId } = (await request.json()) as { companyId?: string }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "companyId es obligatorio." },
        { status: 400 },
      )
    }

    const session = await setActiveCompany(companyId)
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
