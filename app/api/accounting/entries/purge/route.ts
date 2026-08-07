import { NextResponse } from "next/server"
import {
  authErrorResponse,
  resolveImportCompanyFromBody,
  resolveImportCompanyFromQuery,
} from "@/lib/auth/api-auth"
import {
  deleteAccountingEntries,
  getCompanyAccountingVolume,
  parseAccountingEntryPurgeFilter,
  type AccountingEntryPurgeFilter,
} from "@/lib/accounting/entry-service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

function parseFilterFromSearchParams(searchParams: URLSearchParams): AccountingEntryPurgeFilter {
  return parseAccountingEntryPurgeFilter({
    mode: searchParams.get("mode") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    quarter: searchParams.get("quarter") ?? undefined,
    refs: searchParams.get("refs") ?? undefined,
    refNumbers: searchParams.get("refNumbers") ?? undefined,
  })
}

function parseFilterFromBody(body: Record<string, unknown>): AccountingEntryPurgeFilter {
  const filter = body.filter
  if (filter && typeof filter === "object") {
    const typed = filter as Record<string, unknown>
    return parseAccountingEntryPurgeFilter({
      mode: typeof typed.mode === "string" ? typed.mode : undefined,
      year: typeof typed.year === "number" ? typed.year : String(typed.year ?? ""),
      quarter:
        typeof typed.quarter === "number" ? typed.quarter : String(typed.quarter ?? ""),
      refs: typeof typed.refs === "string" ? typed.refs : undefined,
      refNumbers: typeof typed.refNumbers === "string" ? typed.refNumbers : undefined,
    })
  }

  return { mode: "all" }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { companyId } = await resolveImportCompanyFromQuery(request, searchParams)
    const filter = parseFilterFromSearchParams(searchParams)
    const volume = await getCompanyAccountingVolume(companyId, filter)

    return NextResponse.json({ success: true, volume, filter })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyId?: string
      confirm?: boolean
      filter?: Record<string, unknown>
    }
    const { companyId } = await resolveImportCompanyFromBody(request, body)

    if (body.confirm !== true) {
      return NextResponse.json(
        { success: false, error: "Confirmación requerida para borrar la contabilidad." },
        { status: 400 },
      )
    }

    const filter = parseFilterFromBody(body)
    const result = await deleteAccountingEntries(companyId, filter)

    return NextResponse.json({ success: true, result, filter })
  } catch (error) {
    return authErrorResponse(error)
  }
}
