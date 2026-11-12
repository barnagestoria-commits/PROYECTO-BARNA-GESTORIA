import { NextResponse } from "next/server"
import { AuthApiError, authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { parsePunteoAmount, type PunteoWindow } from "@/lib/accounting/account-punteo"
import { listPunteoAccounts, setEntryLinesPunteado } from "@/lib/accounting/account-punteo-service"

function readYear(value: string | null): number | null {
  const year = value ? Number.parseInt(value, 10) : new Date().getFullYear()
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  return year
}

function readWindow(url: URL, year: number): PunteoWindow {
  const fromDate = url.searchParams.get("from")?.trim() || `${year}-01-01`
  const toDate = url.searchParams.get("to")?.trim() || `${year}-12-31`
  return {
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : `${year}-01-01`,
    toDate: /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : `${year}-12-31`,
    fromAmount: parsePunteoAmount(url.searchParams.get("min") ?? ""),
    toAmount: parsePunteoAmount(url.searchParams.get("max") ?? ""),
  }
}

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const year = readYear(url.searchParams.get("year"))
    if (!year) {
      return NextResponse.json({ success: false, error: "Ejercicio no válido." }, { status: 400 })
    }

    const accounts = await listPunteoAccounts(companyId, year, readWindow(url, year))
    return NextResponse.json({ success: true, accounts })
  } catch (error) {
    if (error instanceof AuthApiError) return authErrorResponse(error)
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as { lineIds?: unknown; punteado?: unknown }
    if (body.punteado !== true && body.punteado !== false) {
      return NextResponse.json({ success: false, error: "Indica si el apunte queda punteado." }, { status: 400 })
    }
    if (!Array.isArray(body.lineIds) || body.lineIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ success: false, error: "Indica los apuntes a puntear." }, { status: 400 })
    }

    const result = await setEntryLinesPunteado(companyId, body.lineIds, body.punteado)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AuthApiError) return authErrorResponse(error)
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
