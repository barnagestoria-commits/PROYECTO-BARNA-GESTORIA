import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { resolveAccountParentCode } from "@/lib/accounting/new-account-prefix"
import { previewLedgerSubaccount } from "@/lib/accounting/ledger-subaccount-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const parentCode = url.searchParams.get("parentCode")?.trim() ?? ""
    const name = url.searchParams.get("name")?.trim() ?? ""

    const meta = resolveAccountParentCode(parentCode)
    if (!meta || meta.isThirdParty) {
      return NextResponse.json({ success: false, error: "Prefijo de cuenta no válido." }, { status: 400 })
    }

    const resolution = await previewLedgerSubaccount(
      companyId,
      meta.code,
      name || "Nueva subcuenta",
    )

    return NextResponse.json({ success: true, resolution })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
