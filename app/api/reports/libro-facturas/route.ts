import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildInvoiceRegisterListing,
  buildInvoiceRegisterXlsx,
  parseInvoiceRegisterQuery,
} from "@/lib/reports/invoice-register"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const parsed = parseInvoiceRegisterQuery(url)
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const listing = await buildInvoiceRegisterListing(companyId, parsed)
    if (url.searchParams.get("format") === "xlsx") {
      const buffer = await buildInvoiceRegisterXlsx(listing, parsed.withTotal)
      const filename = `libro-facturas-${parsed.from}-${parsed.to}.xlsx`
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ success: true, listing })
  } catch (error) {
    return authErrorResponse(error)
  }
}
