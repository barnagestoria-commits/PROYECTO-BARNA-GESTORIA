import JSZip from "jszip"
import { generateReportCsv } from "@/lib/reports/csv/generate-report-csv"
import { generateReportXlsx } from "@/lib/reports/excel/generate-report-xlsx"
import { generateReportPdf } from "@/lib/reports/pdf/generate-report-pdf"
import { buildReportFilename } from "@/lib/reports/report-query"
import type { LedgerQuery } from "@/lib/reports/account-ledger"
import type { ReportType } from "@/lib/reports/types"

export async function generateReportZip(
  type: ReportType,
  query: LedgerQuery,
  companyName: string,
): Promise<Buffer> {
  const [pdfBuffer, xlsxBuffer, csvBuffer] = await Promise.all([
    generateReportPdf(type, query),
    generateReportXlsx(type, query),
    generateReportCsv(type, query),
  ])

  const zip = new JSZip()
  zip.file(buildReportFilename(type, companyName, query.year, "pdf"), pdfBuffer)
  zip.file(buildReportFilename(type, companyName, query.year, "xlsx"), xlsxBuffer)
  zip.file(buildReportFilename(type, companyName, query.year, "csv"), csvBuffer)

  return zip.generateAsync({ type: "nodebuffer" })
}

export async function generateListadosBundleZip(query: LedgerQuery, companyName: string): Promise<Buffer> {
  const types: ReportType[] = ["balance", "sumas-saldos", "pyg"]
  const zip = new JSZip()

  for (const type of types) {
    const folder = zip.folder(type)
    if (!folder) continue

    const [pdfBuffer, xlsxBuffer, csvBuffer] = await Promise.all([
      generateReportPdf(type, query),
      generateReportXlsx(type, query),
      generateReportCsv(type, query),
    ])

    folder.file(buildReportFilename(type, companyName, query.year, "pdf"), pdfBuffer)
    folder.file(buildReportFilename(type, companyName, query.year, "xlsx"), xlsxBuffer)
    folder.file(buildReportFilename(type, companyName, query.year, "csv"), csvBuffer)
  }

  return zip.generateAsync({ type: "nodebuffer" })
}
