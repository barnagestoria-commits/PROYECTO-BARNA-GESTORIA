import { NextResponse } from "next/server"
import { requireRequestSession } from "@/lib/auth/api-auth"
import { authErrorResponse } from "@/lib/auth/api-auth"

export async function GET(request: Request) {
  try {
    const session = await requireRequestSession(request)
    return NextResponse.json({ success: true, companies: session.companies })
  } catch (error) {
    return authErrorResponse(error)
  }
}
