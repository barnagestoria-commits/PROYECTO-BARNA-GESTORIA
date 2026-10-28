import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  applyClientProfilePreset,
  getOrCreateCompanyFiscalSettings,
  updateCompanyFiscalSettings,
} from "@/lib/fiscal/fiscal-settings-service"
import type { CompanyClientProfile } from "@prisma/client"

function optionalAmount(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/\s/g, "").replace(",", "."))
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.round(parsed * 100) / 100
}

function optionalPriorQuota(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  return optionalAmount(value)
}

function optionalTaxRate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) return undefined
  return parsed
}

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
      model123Enabled: body.model123Enabled,
      model130Enabled: body.model130Enabled,
      model202Enabled: body.model202Enabled,
      model202Modality:
        body.model202Modality === "ART_40_2" || body.model202Modality === "ART_40_3"
          ? body.model202Modality
          : undefined,
      model202TaxRate: optionalTaxRate(body.model202TaxRate),
      model202PriorNetQuota: optionalPriorQuota(body.model202PriorNetQuota),
      model202LargeTurnover:
        typeof body.model202LargeTurnover === "boolean" ? body.model202LargeTurnover : undefined,
      model202Increase: optionalAmount(body.model202Increase),
      model202Decrease: optionalAmount(body.model202Decrease),
      model202NegativeBases: optionalAmount(body.model202NegativeBases),
      model180Enabled: body.model180Enabled,
      model190Enabled: body.model190Enabled,
      model303Enabled: body.model303Enabled,
      model347Enabled: body.model347Enabled,
      model349Enabled: body.model349Enabled,
      model390Enabled: body.model390Enabled,
    })

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    return authErrorResponse(error)
  }
}
