import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { buildPdfFilename, generateReportPdf } from "@/lib/reports/pdf/generate-report-pdf"
import { prisma } from "@/lib/db"
import type { ReportType } from "@/lib/reports/types"
import { REPORT_LABELS } from "@/lib/reports/types"
import {
  VALID_REPORT_TYPES,
  parseReportQueryFromUrl,
  toLedgerQueryFields,
} from "@/lib/reports/report-query"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ reportType: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { reportType: reportTypeParam } = await params
    const { companyId } = await requireActiveCompany(request)
    const reportType = reportTypeParam as ReportType

    if (!VALID_REPORT_TYPES.has(reportType)) {
      return NextResponse.json(
        { success: false, error: `Informe no válido. Opciones: ${[...VALID_REPORT_TYPES].join(", ")}` },
        { status: 400 },
      )
    }

    const parsed = parseReportQueryFromUrl(new URL(request.url))
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    })

    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 })
    }

    const pdfBuffer = await generateReportPdf(reportType, toLedgerQueryFields(companyId, parsed))

    const filename = buildPdfFilename(reportType, company.name, parsed.year)
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
