import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { enterSupportCompany } from "@/lib/auth/service"

export async function POST(request: Request) {
  try {
    await requirePlatformOperator(request)
    const { companyId } = (await request.json()) as { companyId?: string }
    if (!companyId?.trim()) {
      return NextResponse.json(
        { success: false, error: "Indica la empresa a la que quieres entrar." },
        { status: 400 },
      )
    }
    const session = await enterSupportCompany(companyId.trim())
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
