import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  applyClientProfilePreset,
  getOrCreateCompanyFiscalSettings,
  updateCompanyFiscalSettings,
} from "@/lib/fiscal/fiscal-settings-service"
import type { CompanyClientProfile } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const settings = await getOrCreateCompanyFiscalSettings(companyId)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const body = await request.json()

    if (body.applyProfile && typeof body.applyProfile === "string") {
      const settings = await applyClientProfilePreset(
        companyId,
        body.applyProfile as CompanyClientProfile,
      )
      return NextResponse.json({ success: true, settings })
    }

    const settings = await updateCompanyFiscalSettings(companyId, {
      clientProfile: body.clientProfile,
      model111Enabled: body.model111Enabled,
      model115Enabled: body.model115Enabled,
      model180Enabled: body.model180Enabled,
      model303Enabled: body.model303Enabled,
    })

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}
