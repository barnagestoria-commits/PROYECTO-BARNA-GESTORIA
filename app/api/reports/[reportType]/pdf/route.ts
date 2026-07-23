import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildPdfFilename, generateReportPdf } from "@/lib/reports/pdf/generate-report-pdf"
import { prisma } from "@/lib/db"
import type { ReportType } from "@/lib/reports/types"
import { REPORT_LABELS } from "@/lib/reports/types"

export const runtime = "nodejs"

const VALID_TYPES = new Set<ReportType>(["balance", "sumas-saldos", "pyg"])

interface RouteContext {
  params: Promise<{ reportType: string }>
}

function parseYear(value: string | null): number | null {
  if (!value) return new Date().getFullYear()
  const year = Number.parseInt(value, 10)
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null
  return year
}

function parseMonth(value: string | null): number | undefined {
  if (!value) return undefined
  const month = Number.parseInt(value, 10)
  if (!Number.isFinite(month) || month < 1 || month > 12) return undefined
  return month
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { reportType: reportTypeParam } = await params
    const { companyId } = await requireActiveCompany(request)
    const reportType = reportTypeParam as ReportType

    if (!VALID_TYPES.has(reportType)) {
      return NextResponse.json(
        { success: false, error: `Informe no válido. Opciones: ${[...VALID_TYPES].join(", ")}` },
        { status: 400 },
      )
    }

    const url = new URL(request.url)
    const year = parseYear(url.searchParams.get("year"))
    if (year === null) {
      return NextResponse.json({ success: false, error: "Ejercicio no válido." }, { status: 400 })
    }

    const fromMonth = parseMonth(url.searchParams.get("fromMonth"))
    const toMonth = parseMonth(url.searchParams.get("toMonth"))

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    })

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    const pdfBuffer = await generateReportPdf(reportType, {
      companyId,
      year,
      fromMonth,
      toMonth,
    })

    const filename = buildPdfFilename(reportType, company.name, year)
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store",
        "X-Report-Type": reportType,
        "X-Report-Label": REPORT_LABELS[reportType],
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
