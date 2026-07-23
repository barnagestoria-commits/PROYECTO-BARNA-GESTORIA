import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import {
  buildFiscalExportFilename,
  generateAeatTxt,
  generateFiscalCsv,
  generateFiscalPdf,
  generateFiscalXlsx,
  generateFiscalZip,
  shouldOfferAeatTxt,
  type FiscalExportFormat,
} from "@/lib/fiscal/export-fiscal-model"
import { buildFiscalModelDetail, isValidModelCode } from "@/lib/fiscal/panorama-service"
import { parseDetailQuarter } from "@/lib/fiscal/panorama"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ model: string; year: string; quarter: string; format: string }>
}

const VALID_FORMATS = new Set<FiscalExportFormat>(["pdf", "xlsx", "csv", "txt", "zip"])

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { model, year: yearParam, quarter: quarterParam, format: formatParam } = await params
    const { companyId } = await requireActiveCompany(request)

    if (!isValidModelCode(model)) {
      return NextResponse.json({ success: false, error: "Modelo fiscal no válido." }, { status: 400 })
    }

    const format = formatParam as FiscalExportFormat
    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json(
        { success: false, error: "Formato no válido. Use pdf, xlsx, csv, txt o zip." },
        { status: 400 },
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
      prisma.company.findUnique({ where: { id: companyId }, select: { name: true, cif: true } }),
    ])

    if (!detail) {
      return NextResponse.json({ success: false, error: "Modelo no encontrado." }, { status: 404 })
    }

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    if (format === "txt" && !shouldOfferAeatTxt(detail)) {
      return NextResponse.json(
        {
          success: false,
          error: "El archivo .txt de Hacienda solo está disponible para modelos trimestrales (111, 115, 303) o el 180 anual.",
        },
        { status: 400 },
      )
    }

    let buffer: Buffer | undefined
    let contentType = "application/octet-stream"

    switch (format) {
      case "pdf":
        buffer = await generateFiscalPdf(detail, company.name)
        contentType = "application/pdf"
        break
      case "xlsx":
        buffer = await generateFiscalXlsx(detail, company.name)
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        break
      case "csv":
        buffer = generateFiscalCsv(detail, company.name)
        contentType = "text/csv; charset=utf-8"
        break
      case "txt":
        buffer = generateAeatTxt(detail, company.name, company.cif)
        contentType = "text/plain; charset=iso-8859-1"
        break
      case "zip":
        buffer = await generateFiscalZip(detail, company.name, company.cif)
        contentType = "application/zip"
        break
    }

    if (!buffer) {
      return NextResponse.json({ success: false, error: "No se pudo generar la exportación." }, { status: 500 })
    }

    const filename = buildFiscalExportFilename(detail, company.name, format, company.cif)
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Fiscal-Model": detail.modelCode,
        "X-Fiscal-Format": format,
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
