import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { generateReportCsv } from "@/lib/reports/csv/generate-report-csv"
import { prisma } from "@/lib/db"
import {
  VALID_REPORT_TYPES,
  buildReportFilename,
  parseReportQueryFromUrl,
} from "@/lib/reports/report-query"
import type { ReportType } from "@/lib/reports/types"
import { REPORT_LABELS } from "@/lib/reports/types"

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

    const csvBuffer = await generateReportCsv(reportType, {
      companyId,
      year: parsed.year,
      fromMonth: parsed.fromMonth,
      toMonth: parsed.toMonth,
    })

    const filename = buildReportFilename(reportType, company.name, parsed.year, "csv")
    const encodedFilename = encodeURIComponent(filename)

    return new NextResponse(new Uint8Array(csvBuffer), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(csvBuffer.length),
        "Cache-Control": "no-store",
        "X-Report-Type": reportType,
        "X-Report-Label": REPORT_LABELS[reportType],
      },
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
