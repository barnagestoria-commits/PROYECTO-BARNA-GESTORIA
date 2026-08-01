import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { importParsedA3EntryBatch } from "@/lib/imports/a3/a3-import-service"
import type { A3JournalEntry } from "@/lib/imports/a3/types"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

interface BatchParsedBody {
  companyId?: string
  importId: string
  entries: A3JournalEntry[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BatchParsedBody
    const { session, companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.importId?.trim()) {
      return NextResponse.json({ success: false, error: "Importación no identificada." }, { status: 400 })
    }

    const entries = Array.isArray(body.entries) ? body.entries : []
    const result = await importParsedA3EntryBatch(
      companyId,
      body.importId.trim(),
      entries,
      session.user.id,
    )

    return NextResponse.json({
      success: true,
      batch: result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
