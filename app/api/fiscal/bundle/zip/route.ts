import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildFiscalBundleFilename,
  generateFiscalBundleZip,
} from "@/lib/fiscal/export-fiscal-model"
import {
  ANNUAL_SUMMARY_MODELS,
  getEnabledModels,
  isModelEnabled,
  isQuarterlyModel,
} from "@/lib/fiscal/fiscal-settings"
import { getOrCreateCompanyFiscalSettings } from "@/lib/fiscal/fiscal-settings-service"
import { buildFiscalModelDetail } from "@/lib/fiscal/panorama-service"
import { parseYear } from "@/lib/reports/report-query"
import { prisma } from "@/lib/db"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { companyId } = await requireActiveCompany(request)
    const url = new URL(request.url)
    const year = parseYear(url.searchParams.get("year"))
    const scope = url.searchParams.get("scope") ?? "annual"

    if (year === null) {
      return NextResponse.json({ success: false, error: "Ejercicio no válido." }, { status: 400 })
    }

    const [company, settings] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true, cif: true } }),
      getOrCreateCompanyFiscalSettings(companyId),
    ])

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    const enabledModels = getEnabledModels(settings)
    const details: FiscalModelDetailResponse[] = []

    if (scope === "annual") {
      for (const model of ANNUAL_SUMMARY_MODELS) {
        if (!isModelEnabled(settings, model)) continue
        const detail = await buildFiscalModelDetail(companyId, model, year, "annual")
        if (detail) details.push(detail)
      }
    } else {
      for (const model of enabledModels) {
        if (!isQuarterlyModel(model)) continue
        for (const quarter of [1, 2, 3, 4] as const) {
          const detail = await buildFiscalModelDetail(companyId, model, year, quarter)
          if (detail) details.push(detail)
        }
      }

      if (isModelEnabled(settings, "180")) {
        const annual180 = await buildFiscalModelDetail(companyId, "180", year, "annual")
        if (annual180) details.push(annual180)
      }
    }

    if (details.length === 0) {
      return NextResponse.json({ success: false, error: "No hay modelos fiscales habilitados para exportar." }, { status: 404 })
    }

    const zipBuffer = await generateFiscalBundleZip(details, company.name, company.cif)
    const filename =
      scope === "annual"
        ? buildFiscalBundleFilename(company.name, year).replace(".zip", "-anual.zip")
        : buildFiscalBundleFilename(company.name, year).replace(".zip", "-trimestral.zip")
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
        "X-Fiscal-Format": "zip-bundle",
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
