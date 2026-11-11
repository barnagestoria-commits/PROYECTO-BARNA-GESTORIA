import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { leaveSupportCompany } from "@/lib/auth/service"

export async function POST(request: Request) {
  try {
    await requirePlatformOperator(request)
    const session = await leaveSupportCompany()
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
