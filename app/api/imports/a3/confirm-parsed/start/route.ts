import { NextResponse } from "next/server"
import { authErrorResponse, resolveImportCompanyFromBody } from "@/lib/auth/api-auth"
import { startParsedA3Import, type A3ParsedImportMeta } from "@/lib/imports/a3/a3-import-service"
import type { A3VendorRef } from "@/lib/imports/a3/a3-client-import"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

interface StartParsedBody {
  companyId?: string
  fileName: string
  meta: A3ParsedImportMeta
  vendorRefs: A3VendorRef[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartParsedBody
    const { session, companyId } = await resolveImportCompanyFromBody(request, body)

    if (!body.fileName?.trim()) {
      return NextResponse.json({ success: false, error: "Nombre de archivo no proporcionado." }, { status: 400 })
    }

    if (!body.meta) {
      return NextResponse.json({ success: false, error: "Metadatos de importación no proporcionados." }, { status: 400 })
    }

    const vendorRefs = Array.isArray(body.vendorRefs) ? body.vendorRefs : []
    const result = await startParsedA3Import(
      companyId,
      body.fileName.trim(),
      body.meta,
      vendorRefs,
      session.user.id,
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
