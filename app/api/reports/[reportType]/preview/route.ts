import { NextResponse } from "next/server"
import { authErrorResponse, requireActiveCompany } from "@/lib/auth/api-auth"
import { fetchReportData, serializeReportData } from "@/lib/reports/fetch-report-data"
import {
  VALID_REPORT_TYPES,
  parseReportQueryFromUrl,
} from "@/lib/reports/report-query"
import type { ReportType } from "@/lib/reports/types"

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

    const report = await fetchReportData(reportType, {
      companyId,
      year: parsed.year,
      fromMonth: parsed.fromMonth,
      toMonth: parsed.toMonth,
    })

    return NextResponse.json({
      success: true,
      preview: serializeReportData(report),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
