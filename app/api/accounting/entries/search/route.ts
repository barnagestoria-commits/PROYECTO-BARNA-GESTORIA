import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { searchEntriesByRef } from "@/lib/accounting/entry-ref-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const last = url.searchParams.get("last") === "true"
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")
    const refParam = url.searchParams.get("ref")

    let fromRef: number | undefined
    let toRef: number | undefined

    if (refParam) {
      const ref = Number.parseInt(refParam, 10)
      if (!Number.isFinite(ref) || ref < 1) {
        return NextResponse.json({ success: false, error: "Número de ref. no válido." }, { status: 400 })
      }
      fromRef = ref
      toRef = ref
    } else {
      if (fromParam) {
        fromRef = Number.parseInt(fromParam, 10)
        if (!Number.isFinite(fromRef) || fromRef < 1) {
          return NextResponse.json({ success: false, error: "Ref. desde no válida." }, { status: 400 })
        }
      }
      if (toParam) {
        toRef = Number.parseInt(toParam, 10)
        if (!Number.isFinite(toRef) || toRef < 1) {
          return NextResponse.json({ success: false, error: "Ref. hasta no válida." }, { status: 400 })
        }
      }
    }

    const result = await searchEntriesByRef({
      companyId,
      fromRef,
      toRef,
      last,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
