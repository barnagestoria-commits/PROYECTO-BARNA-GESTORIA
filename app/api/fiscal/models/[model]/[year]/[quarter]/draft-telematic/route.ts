import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildOfficialAeatDraftBundle } from "@/lib/fiscal/aeat/build-official-submission"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import { buildFiscalModelDetail, isValidModelCode } from "@/lib/fiscal/panorama-service"
import { parseDetailQuarter } from "@/lib/fiscal/panorama"
import { resolveCompanyTaxIdentity } from "@/lib/company/resolve-tax-identity"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"
import { shouldOfferAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"

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

    const quarter = parseDetailQuarter(quarterParam)
    if (!quarter) {
      return NextResponse.json({ success: false, error: "Trimestre no válido." }, { status: 400 })
    }

    const [detail, company] = await Promise.all([
      buildFiscalModelDetail(companyId, model, year, quarter),
      resolveCompanyTaxIdentity(companyId),
    ])

    if (!detail) {
      return NextResponse.json({ success: false, error: "Modelo no encontrado." }, { status: 404 })
    }

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    if (!shouldOfferAeatTxt(detail)) {
      return NextResponse.json(
        {
          success: false,
          error: "Este modelo/periodo no admite fichero telemático BOE.",
        },
        { status: 400 },
      )
    }

    const bundle = await buildOfficialAeatDraftBundle(detail, company.name, company.cif)
    if (!bundle.telematicFile) {
      return NextResponse.json(
        { success: false, error: "No se pudo generar el fichero telemático." },
        { status: 500 },
      )
    }

    const official = getAeatModelOfficialSource(detail.modelCode)
    const filename = bundle.validation.filename
    const encodedFilename = encodeURIComponent(filename)
    const validationHeader = encodeURIComponent(JSON.stringify(bundle.validation))

    return new NextResponse(new Uint8Array(bundle.telematicFile), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=iso-8859-1",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(bundle.telematicFile.length),
        "Cache-Control": "no-store",
        "X-Fiscal-Model": detail.modelCode,
        "X-Fiscal-Format": "telematic-boe",
        "X-Aeat-Boe-Extension": official?.boeFileExtension ?? ".txt",
        "X-Aeat-Submission-Valid": bundle.validation.valid ? "true" : "false",
        "X-Aeat-Validation": validationHeader,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
