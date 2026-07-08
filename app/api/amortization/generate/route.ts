import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { generateAmortizations } from "@/lib/fixed-assets/service"

export async function POST(request: Request) {
  try {
    const { session, companyId } = await requireActiveCompany(request)
    const result = await generateAmortizations(companyId, session.user.id)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
