import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildVatLiquidationLines,
  calculateVatLiquidation,
} from "@/lib/accounting/vat-liquidation-service"
import { createLineId } from "@/lib/accounting/command-templates"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const year = Number.parseInt(url.searchParams.get("year") ?? "", 10)
    const quarter = Number.parseInt(url.searchParams.get("quarter") ?? "", 10)

    if (!Number.isFinite(year) || year < 2000) {
      return NextResponse.json({ success: false, error: "Año no válido." }, { status: 400 })
    }

    if (![1, 2, 3, 4].includes(quarter)) {
      return NextResponse.json({ success: false, error: "Trimestre no válido (1-4)." }, { status: 400 })
    }

    const liquidation = await calculateVatLiquidation({
      companyId,
      year,
      quarter: quarter as 1 | 2 | 3 | 4,
    })

    const lines = buildVatLiquidationLines(liquidation).map((line) => ({
      ...line,
      id: createLineId(),
    }))

    return NextResponse.json({
      success: true,
      liquidation,
      lines,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
