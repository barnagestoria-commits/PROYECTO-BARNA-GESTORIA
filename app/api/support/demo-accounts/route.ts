import { NextResponse } from "next/server"
import { authErrorResponse, requirePlatformOperator } from "@/lib/auth/api-auth"
import { removeDemoAccounts } from "@/lib/auth/demo-accounts"

export const runtime = "nodejs"

/** Retira las cuentas de ejemplo (lista fija en lib/auth/demo-accounts.ts). Solo el operador. */
export async function POST(request: Request) {
  try {
    await requirePlatformOperator(request)
    const result = await removeDemoAccounts()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
