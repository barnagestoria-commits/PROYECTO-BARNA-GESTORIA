import ExcelJS from "exceljs"
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces"
import JSZip from "jszip"
import {
  buildAeatTxtFilename,
  generateAeatTxt,
  shouldOfferAeatTxt,
} from "@/lib/fiscal/aeat/generate-aeat-txt"
import type { FiscalExportFormat } from "@/lib/fiscal/export-formats"
import { createPdfBuffer } from "@/lib/reports/pdf/pdfmake-client"
import { formatAmount, formatDateTimeEs } from "@/lib/reports/format"
import { slugifyCompanyName } from "@/lib/reports/report-query"
import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"

export type { FiscalExportFormat }

function escapeCsv(value: string | number): string {
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(escapeCsv).join(";")
}

export function buildFiscalExportFilename(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter">,
  companyName: string,
  extension: FiscalExportFormat | "pdf" | "xlsx" | "csv" | "txt",
  companyCif?: string | null,
): string {
  if (extension === "txt") {
    return buildAeatTxtFilename(detail, companyCif)
  }

  const quarterSuffix =
    detail.quarter === "annual" ? "anual" : `${detail.quarter}T`
  const base = `modelo-${detail.modelCode}-${slugifyCompanyName(companyName)}-${detail.year}-${quarterSuffix}`
  return extension === "zip" ? `${base}-export.zip` : `${base}.${extension}`
}

export function buildFiscalBundleFilename(companyName: string, year: number): string {
  return `modelos-fiscales-${slugifyCompanyName(companyName)}-${year}.zip`
}

function flattenFiscalLines(detail: FiscalModelDetailResponse) {
  return detail.breakdown.flatMap((section) =>
    section.lines.map((line) => ({
      section: section.label,
      ...line,
    })),
  )
}

export function generateFiscalCsv(detail: FiscalModelDetailResponse, companyName: string): Buffer {
  const lines = [
    csvRow(["Empresa", companyName]),
    csvRow(["Modelo", detail.modelLabel]),
    csvRow(["Ejercicio", detail.year]),
    csvRow(["Periodo", detail.periodLabel]),
    csvRow(["Importe total", detail.amount.toFixed(2)]),
    csvRow(["Estado", detail.statusLabel]),
    "",
    csvRow(["Sección", "Fecha", "Cuenta", "Concepto", "Debe", "Haber", "Importe"]),
    ...flattenFiscalLines(detail).map((line) =>
      csvRow([
        line.section,
        line.entryDate,
        line.cuenta,
        line.concepto || "",
        line.debe ? line.debe.toFixed(2) : "",
        line.haber ? line.haber.toFixed(2) : "",
        line.signedAmount.toFixed(2),
      ]),
    ),
  ]

  return Buffer.from(`\uFEFF${lines.join("\n")}`, "utf-8")
}

export async function generateFiscalXlsx(
  detail: FiscalModelDetailResponse,
  companyName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Barna Gestoría"
  const sheet = workbook.addWorksheet(`Modelo ${detail.modelCode}`)

  sheet.getCell("A1").value = "BARNA GESTORÍA"
  sheet.getCell("A1").font = { bold: true, color: { argb: "FF145A32" } }
  sheet.getCell("A2").value = detail.modelLabel
  sheet.getCell("A2").font = { bold: true, size: 14 }
  sheet.getCell("A4").value = "Empresa"
  sheet.getCell("B4").value = companyName
  sheet.getCell("A5").value = "Periodo"
  sheet.getCell("B5").value = detail.periodLabel
  sheet.getCell("A6").value = "Importe total"
  sheet.getCell("B6").value = detail.amount
  sheet.getCell("B6").numFmt = "#,##0.00"
  sheet.getCell("A7").value = "Estado"
  sheet.getCell("B7").value = detail.statusLabel

  const header = sheet.getRow(9)
  header.values = ["Sección", "Fecha", "Cuenta", "Concepto", "Debe", "Haber", "Importe"]
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF145A32" } }

  flattenFiscalLines(detail).forEach((line, index) => {
    const row = sheet.getRow(10 + index)
    row.values = [
      line.section,
      line.entryDate,
      line.cuenta,
      line.concepto || "",
      line.debe || 0,
      line.haber || 0,
      line.signedAmount,
    ]
    row.getCell(5).numFmt = "#,##0.00"
    row.getCell(6).numFmt = "#,##0.00"
    row.getCell(7).numFmt = "#,##0.00"
  })

  sheet.getColumn(1).width = 24
  sheet.getColumn(4).width = 36

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

export async function generateFiscalPdf(
  detail: FiscalModelDetailResponse,
  companyName: string,
): Promise<Buffer> {
  const bodyRows = detail.breakdown.flatMap((section) => {
    const sectionHeader: Content = {
      text: section.label,
      style: "section",
      margin: [0, 8, 0, 4],
    }

    if (section.lines.length === 0) {
      return [sectionHeader, { text: "Sin movimientos.", style: "meta", margin: [0, 0, 0, 8] }] as Content[]
    }

    return [
      sectionHeader,
      {
        table: {
          headerRows: 1,
          widths: [52, 42, "*", 48, 48, 52],
          body: [
            [
              { text: "Fecha", style: "tableHeader" },
              { text: "Cuenta", style: "tableHeader" },
              { text: "Concepto", style: "tableHeader" },
              { text: "Debe", style: "tableHeader", alignment: "right" },
              { text: "Haber", style: "tableHeader", alignment: "right" },
              { text: "Importe", style: "tableHeader", alignment: "right" },
            ],
            ...section.lines.map((line) => [
              line.entryDate,
              line.cuenta,
              line.concepto || "—",
              { text: line.debe ? formatAmount(line.debe) : "—", alignment: "right" },
              { text: line.haber ? formatAmount(line.haber) : "—", alignment: "right" },
              { text: formatAmount(line.signedAmount), alignment: "right" },
            ]),
            [
              { text: "Total sección", colSpan: 5, bold: true },
              "",
              "",
              "",
              "",
              { text: formatAmount(section.total), alignment: "right", bold: true },
            ],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      },
    ] as Content[]
  })

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    content: [
      { text: "BARNA GESTORÍA", style: "brand" },
      { text: detail.modelLabel, style: "title" },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: companyName, style: "company" },
              { text: detail.periodLabel, style: "meta" },
              { text: `Estado: ${detail.statusLabel}`, style: "meta" },
            ],
          },
          {
            width: "auto",
            alignment: "right",
            stack: [
              { text: "Importe total", style: "meta" },
              { text: formatAmount(detail.amount), style: "amount" },
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },
      ...bodyRows,
    ],
    styles: {
      brand: { fontSize: 9, bold: true, color: "#145A32" },
      title: { fontSize: 16, bold: true, color: "#0F3D2E", margin: [0, 0, 0, 8] },
      company: { fontSize: 10, bold: true },
      meta: { fontSize: 9, color: "#6B7280" },
      amount: { fontSize: 14, bold: true, color: "#0F3D2E" },
      section: { fontSize: 11, bold: true, color: "#145A32" },
      tableHeader: { fontSize: 8, bold: true, color: "#FFFFFF", fillColor: "#145A32" },
    },
    footer: (currentPage, pageCount) => ({
      margin: [40, 0, 40, 20],
      columns: [
        { text: `Generado el ${formatDateTimeEs(new Date())}`, fontSize: 7, color: "#6B7280" },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: "right", fontSize: 7, color: "#6B7280" },
      ],
    }),
  }

  return createPdfBuffer(doc)
}

export async function generateFiscalZip(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif?: string | null,
): Promise<Buffer> {
  const [pdfBuffer, xlsxBuffer] = await Promise.all([
    generateFiscalPdf(detail, companyName),
    generateFiscalXlsx(detail, companyName),
  ])
  const csvBuffer = generateFiscalCsv(detail, companyName)

  const zip = new JSZip()
  zip.file(buildFiscalExportFilename(detail, companyName, "pdf"), pdfBuffer)
  zip.file(buildFiscalExportFilename(detail, companyName, "xlsx"), xlsxBuffer)
  zip.file(buildFiscalExportFilename(detail, companyName, "csv"), csvBuffer)

  if (shouldOfferAeatTxt(detail)) {
    zip.file(
      buildFiscalExportFilename(detail, companyName, "txt", companyCif),
      generateAeatTxt(detail, companyName, companyCif),
    )
  }

  return zip.generateAsync({ type: "nodebuffer" })
}

export async function generateFiscalBundleZip(
  details: FiscalModelDetailResponse[],
  companyName: string,
  companyCif?: string | null,
): Promise<Buffer> {
  const zip = new JSZip()

  for (const detail of details) {
    const folderName =
      detail.quarter === "annual"
        ? `modelo-${detail.modelCode}-anual`
        : `modelo-${detail.modelCode}-${detail.quarter}T`
    const folder = zip.folder(folderName) ?? zip
    const [pdfBuffer, xlsxBuffer] = await Promise.all([
      generateFiscalPdf(detail, companyName),
      generateFiscalXlsx(detail, companyName),
    ])
    const csvBuffer = generateFiscalCsv(detail, companyName)

    folder.file(buildFiscalExportFilename(detail, companyName, "pdf"), pdfBuffer)
    folder.file(buildFiscalExportFilename(detail, companyName, "xlsx"), xlsxBuffer)
    folder.file(buildFiscalExportFilename(detail, companyName, "csv"), csvBuffer)

    if (shouldOfferAeatTxt(detail)) {
      folder.file(
        buildFiscalExportFilename(detail, companyName, "txt", companyCif),
        generateAeatTxt(detail, companyName, companyCif),
      )
    }
  }

  return zip.generateAsync({ type: "nodebuffer" })
}

export { generateAeatTxt, shouldOfferAeatTxt }
