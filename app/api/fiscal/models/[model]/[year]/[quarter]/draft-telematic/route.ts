import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildOfficialAeatDraftBundle } from "@/lib/fiscal/aeat/build-official-submission"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import { buildFiscalModelDetail, isValidModelCode } from "@/lib/fiscal/panorama-service"
import { quarterly303BlockedForSii, resolveFiscalRoutePeriod } from "@/lib/fiscal/parse-route-period"
import { resolveCompanyTaxIdentity } from "@/lib/company/resolve-tax-identity"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"
import { shouldOfferAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { persistModel303EngineResult } from "@/lib/fiscal/model-303/engine-service"
import {
  resolveModel303OptionsFromRequest,
  withCompanyVatCensus,
} from "@/lib/fiscal/model-303/resolve-export-options-from-request"
import type { Model303FileOptions } from "@/lib/fiscal/aeat/tax-engine-bridge"

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
    if (model === "347" && (company.siiMode === "OBLIGATORIO" || company.siiMode === "VOLUNTARIO")) {
      return NextResponse.json(
        {
          success: false,
          error: "Esta empresa lleva los libros del IVA por el SII. El modelo 347 no se presenta.",
        },
        { status: 422 },
      )
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

    let model303FileOptions: Model303FileOptions = {}
    if (detail.modelCode === "303") {
      const resolved303 = resolveModel303OptionsFromRequest(request, detail, company.taxDirectDebitIban)
      if (resolved303.error) {
        return NextResponse.json({ success: false, error: resolved303.error }, { status: 400 })
      }
      model303FileOptions = withCompanyVatCensus(resolved303.options, company)
    }

    const bundle = await buildOfficialAeatDraftBundle(detail, company.name, company.cif, model303FileOptions)
    if (!bundle.telematicFile) {
      return NextResponse.json(
        { success: false, error: "No se pudo generar el fichero telemático." },
        { status: 500 },
      )
    }
    if ((detail.modelCode === "303" || detail.modelCode === "347" || detail.modelCode === "111") && !bundle.validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            bundle.validation.issues.find((issue) => issue.severity === "error")?.message
            ?? "El fichero contiene errores de validación y no puede descargarse.",
          issues: bundle.validation.issues,
        },
        { status: 422 },
      )
    }

    const official = getAeatModelOfficialSource(detail.modelCode)
    let telematicFile = bundle.telematicFile
    let taxReturnId: string | undefined
    if (detail.modelCode === "303") {
      try {
        const persisted = await persistModel303EngineResult({
          companyId,
          detail,
          companyName: company.name,
          companyCif: company.cif,
          fileOptions: model303FileOptions,
          eventType: "EXPORT_GENERATED",
        })
        telematicFile = persisted.artifact.content
        taxReturnId = persisted.taxReturnId
      } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (message.includes("ya fue presentada")) throw error
        console.error("No se pudo archivar el modelo 303. Se entrega el fichero igualmente.", error)
      }
    }

    const filename = bundle.validation.filename
    const encodedFilename = encodeURIComponent(filename)
    const validationHeader = encodeURIComponent(JSON.stringify(bundle.validation))

    return new NextResponse(new Uint8Array(telematicFile), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=iso-8859-1",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(telematicFile.length),
        "Cache-Control": "no-store",
        "X-Fiscal-Model": detail.modelCode,
        "X-Fiscal-Format": detail.modelCode === "303" ? "dr303-envelope" : "telematic-boe",
        ...(taxReturnId ? { "X-Tax-Return-Id": taxReturnId } : {}),
        "X-Aeat-Boe-Extension": official?.boeFileExtension ?? ".txt",
        "X-Aeat-Submission-Valid": bundle.validation.valid ? "true" : "false",
        "X-Aeat-Validation": validationHeader,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
