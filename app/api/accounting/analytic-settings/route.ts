import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  getCompanyAccountingSettings,
  upsertCompanyAccountingSettings,
} from "@/lib/accounting/analytic-accounting-service"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const settings = await getCompanyAccountingSettings(companyId)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = (await request.json()) as { analyticAccountingEnabled?: boolean }
    const settings = await upsertCompanyAccountingSettings(companyId, {
      analyticAccountingEnabled: Boolean(body.analyticAccountingEnabled),
    })
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}
