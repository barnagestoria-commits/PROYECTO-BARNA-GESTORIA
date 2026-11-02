import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildOfficialAeatDraftBundle } from "@/lib/fiscal/aeat/build-official-submission"
import { buildFiscalModelDetail, isValidModelCode } from "@/lib/fiscal/panorama-service"
import { quarterly303BlockedForSii, resolveFiscalRoutePeriod } from "@/lib/fiscal/parse-route-period"
import { resolveCompanyTaxIdentity } from "@/lib/company/resolve-tax-identity"
import { withCompanyVatCensus } from "@/lib/fiscal/model-303/resolve-export-options-from-request"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ model: string; year: string; quarter: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { model, year: yearParam, quarter: quarterParam } = await params
    const { companyId } = await requireActiveCompany(request)

    if (!isValidModelCode(model) || !DRAFT_SUPPORTED_MODELS.has(model)) {
      return NextResponse.json({ success: false, error: "Modelo fiscal no válido." }, { status: 400 })
    }

    const year = Number.parseInt(yearParam, 10)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: "Año no válido." }, { status: 400 })
    }

    const parsedPeriod = resolveFiscalRoutePeriod(model, quarterParam)
    if ("error" in parsedPeriod) {
      return NextResponse.json({ success: false, error: parsedPeriod.error }, { status: 400 })
    }

    const [detail, company] = await Promise.all([
      buildFiscalModelDetail(companyId, model, year, parsedPeriod.period.quarter, parsedPeriod.period.month),
      resolveCompanyTaxIdentity(companyId),
    ])

    if (!detail) {
      return NextResponse.json({ success: false, error: "Modelo no encontrado." }, { status: 404 })
    }

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    const blocked = quarterly303BlockedForSii(model, parsedPeriod.period, company.siiMode)
    if (blocked) {
      return NextResponse.json({ success: false, error: blocked }, { status: 422 })
    }

    const bundle = await buildOfficialAeatDraftBundle(
      detail,
      company.name,
      company.cif,
      detail.modelCode === "303" ? withCompanyVatCensus({}, company) : {},
    )

    return NextResponse.json({
      success: true,
      modelCode: detail.modelCode,
      year: detail.year,
      quarter: detail.quarter,
      validation: bundle.validation,
      casillaCount: bundle.casillas.length,
      hasTelematicFile: bundle.telematicFile !== null,
      hasDraftPdf: bundle.draftPdf !== null,
      officialSource: bundle.officialSource,
      engine: bundle.engineSummary,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
