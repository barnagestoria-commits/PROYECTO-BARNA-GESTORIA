import { NextResponse } from "next/server"
import { getOAuthStatus } from "@/lib/auth/oauth-config"

export async function GET() {
  return NextResponse.json(getOAuthStatus())
}
