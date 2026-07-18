import { NextResponse } from "next/server"
import { getOAuthSetupInfo } from "@/lib/auth/oauth-config"

export async function GET() {
  return NextResponse.json(getOAuthSetupInfo())
}
