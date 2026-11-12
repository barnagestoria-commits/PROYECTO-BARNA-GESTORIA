import { NextResponse } from "next/server"
import { authErrorResponse, requireRequestSession } from "@/lib/auth/api-auth"
import { saveEntryShortcuts } from "@/lib/auth/service"

export async function PATCH(request: Request) {
  try {
    const session = await requireRequestSession(request)
    const body = (await request.json()) as { byName?: string; byCif?: string }
    const updated = await saveEntryShortcuts(
      session,
      String(body.byName ?? ""),
      String(body.byCif ?? ""),
    )
    return NextResponse.json({ success: true, session: updated })
  } catch (error) {
    return authErrorResponse(error)
  }
}
