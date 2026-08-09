import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildOfficialDraftPdfFilename,
  generateOfficialDraftPdf,
  hasOfficialDraftTemplate,
} from "@/lib/fiscal/official-pdf/generate-official-draft-pdf"
import { buildFiscalModelDetail, isValidModelCode } from "@/lib/fiscal/panorama-service"
import { parseDetailQuarter } from "@/lib/fiscal/panorama"
import { resolveCompanyTaxIdentity } from "@/lib/company/resolve-tax-identity"
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

    if (!hasOfficialDraftTemplate(model)) {
      return NextResponse.json(
        { success: false, error: "Plantilla oficial PDF no disponible para este modelo." },
        { status: 404 },
      )
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

    const buffer = await generateOfficialDraftPdf(detail, company.name, company.cif)
    const filename = buildOfficialDraftPdfFilename(detail, company.name)
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Fiscal-Model": detail.modelCode,
        "X-Fiscal-Format": "draft-pdf",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
