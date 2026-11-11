import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { searchSupportAccounts } from "@/lib/auth/support-directory"

export async function GET(request: Request) {
  try {
    await requirePlatformOperator(request)
    const query = new URL(request.url).searchParams.get("q") ?? ""
    const result = await searchSupportAccounts(query)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
