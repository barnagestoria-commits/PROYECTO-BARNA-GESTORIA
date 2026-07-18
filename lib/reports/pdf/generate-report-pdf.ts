import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces"
import { createPdfBuffer } from "@/lib/reports/pdf/pdfmake-client"
import { filterAccountsWithMovement } from "@/lib/reports/build-sumas-saldos"
import { fetchReportData } from "@/lib/reports/fetch-report-data"
import { formatAmount, formatDateTimeEs, formatEuro } from "@/lib/reports/format"
import type {
  BalanceReportData,
  PygReportData,
  ReportMeta,
  ReportType,
  SumasSaldosReportData,
} from "@/lib/reports/types"
import type { LedgerQuery } from "@/lib/reports/account-ledger"

const EMERALD = "#145A32"
const EMERALD_DARK = "#0F3D2E"
const GRAPHITE = "#2C2C2C"
const MUTED = "#6B7280"
const BORDER = "#E5E7EB"
const ZEBRA = "#F9FAFB"

const tableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => BORDER,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

function labelCell(label: string, level: number): TableCell {
  return { text: `${"  ".repeat(level)}${label}`, fontSize: 8 }
}

function cuentaCell(cuenta: string): TableCell {
  return { text: cuenta, fontSize: 8 }
}

function amountCell(value: number): TableCell {
  return { text: formatAmount(value), alignment: "right", fontSize: 8, noWrap: true }
}

function headerBlock(meta: ReportMeta): Content[] {
  return [
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: "BARNA GESTORÍA", style: "brand", margin: [0, 0, 0, 2] },
            { text: meta.reportTitle, style: "title" },
          ],
        },
        {
          width: "auto",
          alignment: "right",
          stack: [
            { text: meta.companyName, style: "companyName" },
            { text: meta.companyCif ? `NIF: ${meta.companyCif}` : "NIF: —", style: "meta" },
            { text: `Ejercicio ${meta.year}`, style: "meta" },
            { text: meta.periodLabel, style: "meta" },
          ],
        },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 2, color: EMERALD }],
      margin: [0, 0, 0, 16],
    },
  ]
}

function footer(meta: ReportMeta): TDocumentDefinitions["footer"] {
  return (currentPage, pageCount) => ({
    margin: [40, 0, 40, 20],
    columns: [
      {
        text: `Generado el ${formatDateTimeEs(meta.generatedAt)}`,
        fontSize: 7,
        color: MUTED,
      },
      {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: "right",
        fontSize: 7,
        color: MUTED,
      },
    ],
  })
}

function baseStyles(): TDocumentDefinitions["styles"] {
  return {
    brand: { fontSize: 8, bold: true, color: EMERALD, characterSpacing: 1.2 },
    title: { fontSize: 16, bold: true, color: EMERALD_DARK },
    companyName: { fontSize: 10, bold: true, color: GRAPHITE },
    meta: { fontSize: 8, color: MUTED, margin: [0, 1, 0, 0] },
    sectionTitle: { fontSize: 10, bold: true, color: EMERALD_DARK, margin: [0, 10, 0, 6] },
    tableHeader: { bold: true, color: "#FFFFFF", fontSize: 8 },
    totalRow: { bold: true, color: EMERALD_DARK, fontSize: 9 },
    empty: { fontSize: 9, color: MUTED, italics: true, margin: [0, 20, 0, 0] },
  }
}

function tableFillColor(rowIndex: number, rowCount: number): string | null {
  if (rowIndex === 0) return EMERALD
  if (rowIndex === rowCount - 1) return "#ECFDF5"
  return rowIndex % 2 === 0 ? ZEBRA : null
}

function buildSumasSaldosPdf(report: SumasSaldosReportData): Content[] {
  const rows = filterAccountsWithMovement(report.rows)

  const body: TableCell[][] = [
    [
      { text: "Cuenta", style: "tableHeader" },
      { text: "Descripción", style: "tableHeader" },
      { text: "Debe", style: "tableHeader", alignment: "right" },
      { text: "Haber", style: "tableHeader", alignment: "right" },
      { text: "Saldo", style: "tableHeader", alignment: "right" },
    ],
    ...rows.map(
      (row): TableCell[] => [
        cuentaCell(row.cuenta),
        labelCell(row.label, row.level),
        amountCell(row.totalDebe),
        amountCell(row.totalHaber),
        amountCell(row.saldo),
      ],
    ),
    [
      { text: "TOTALES", style: "totalRow" },
      { text: "", style: "totalRow" },
      { text: formatAmount(report.totalDebe), style: "totalRow", alignment: "right" },
      { text: formatAmount(report.totalHaber), style: "totalRow", alignment: "right" },
      {
        text: formatAmount(report.totalDebe - report.totalHaber),
        style: "totalRow",
        alignment: "right",
      },
    ],
  ]

  if (rows.length === 0) {
    return [{ text: "No hay movimientos contables en el periodo seleccionado.", style: "empty" }]
  }

  return [
    {
      table: {
        headerRows: 1,
        widths: [52, "*", 62, 62, 62],
        body,
      },
      layout: {
        ...tableLayout,
        fillColor: (rowIndex: number) => tableFillColor(rowIndex, body.length),
      },
    },
  ]
}

function sectionTable(
  sections: Array<{
    title: string
    rows: Array<{ cuenta: string; label: string; amount: number; level: number }>
    subtotal: number
  }>,
): Content[] {
  const content: Content[] = []

  for (const section of sections) {
    content.push({ text: section.title, style: "sectionTitle" })

    const body: TableCell[][] = [
      [
        { text: "Cuenta", style: "tableHeader" },
        { text: "Descripción", style: "tableHeader" },
        { text: "Importe", style: "tableHeader", alignment: "right" },
      ],
      ...section.rows.map(
        (row): TableCell[] => [
          cuentaCell(row.cuenta),
          labelCell(row.label, row.level),
          amountCell(row.amount),
        ],
      ),
      [
        { text: `Subtotal ${section.title}`, style: "totalRow" },
        { text: "", style: "totalRow" },
        { text: formatAmount(section.subtotal), style: "totalRow", alignment: "right" },
      ],
    ]

    content.push({
      table: {
        headerRows: 1,
        widths: [52, "*", 72],
        body,
      },
      layout: {
        ...tableLayout,
        fillColor: (rowIndex: number) => tableFillColor(rowIndex, body.length),
      },
      margin: [0, 0, 0, 4],
    })
  }

  return content
}

function buildBalancePdf(report: BalanceReportData): Content[] {
  return [
    { text: "ACTIVO", style: "sectionTitle", margin: [0, 0, 0, 4] },
    ...(report.activo.length > 0
      ? sectionTable(report.activo)
      : [{ text: "Sin saldos de activo en el periodo.", style: "empty" }]),
    {
      columns: [
        { text: "TOTAL ACTIVO", style: "totalRow" },
        { text: formatEuro(report.totalActivo), style: "totalRow", alignment: "right" },
      ],
      margin: [0, 8, 0, 16],
    },
    { text: "PATRIMONIO NETO Y PASIVO", style: "sectionTitle", margin: [0, 0, 0, 4] },
    ...(report.pasivo.length > 0
      ? sectionTable(report.pasivo)
      : [{ text: "Sin saldos de pasivo en el periodo.", style: "empty" }]),
    {
      columns: [
        { text: "TOTAL PATRIMONIO NETO Y PASIVO", style: "totalRow" },
        { text: formatEuro(report.totalPasivo), style: "totalRow", alignment: "right" },
      ],
      margin: [0, 8, 0, 0],
    },
  ]
}

function buildPygPdf(report: PygReportData): Content[] {
  return [
    { text: "INGRESOS", style: "sectionTitle", margin: [0, 0, 0, 4] },
    ...(report.ingresos.length > 0
      ? sectionTable(report.ingresos)
      : [{ text: "Sin ingresos registrados en el periodo.", style: "empty" }]),
    {
      columns: [
        { text: "TOTAL INGRESOS", style: "totalRow" },
        { text: formatEuro(report.totalIngresos), style: "totalRow", alignment: "right" },
      ],
      margin: [0, 4, 0, 12],
    },
    { text: "GASTOS", style: "sectionTitle", margin: [0, 0, 0, 4] },
    ...(report.gastos.length > 0
      ? sectionTable(report.gastos)
      : [{ text: "Sin gastos registrados en el periodo.", style: "empty" }]),
    {
      columns: [
        { text: "TOTAL GASTOS", style: "totalRow" },
        { text: formatEuro(report.totalGastos), style: "totalRow", alignment: "right" },
      ],
      margin: [0, 4, 0, 12],
    },
    {
      canvas: [{ type: "rect", x: 0, y: 0, w: 515, h: 1, color: BORDER }],
      margin: [0, 4, 0, 8],
    },
    {
      columns: [
        { text: "RESULTADO DEL EJERCICIO", fontSize: 11, bold: true, color: EMERALD_DARK },
        {
          text: formatEuro(report.resultado),
          fontSize: 11,
          bold: true,
          alignment: "right",
          color: report.resultado >= 0 ? EMERALD : "#B91C1C",
        },
      ],
      margin: [0, 0, 0, 0],
    },
  ]
}

export async function generateReportPdf(type: ReportType, query: LedgerQuery): Promise<Buffer> {
  const report = await fetchReportData(type, query)

  let content: Content[]
  let meta: ReportMeta

  switch (report.type) {
    case "sumas-saldos":
      meta = report.data.meta
      content = buildSumasSaldosPdf(report.data)
      break
    case "balance":
      meta = report.data.meta
      content = buildBalancePdf(report.data)
      break
    case "pyg":
      meta = report.data.meta
      content = buildPygPdf(report.data)
      break
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 9, color: GRAPHITE },
    styles: baseStyles(),
    footer: footer(meta),
    content: [...headerBlock(meta), ...content],
  }

  return createPdfBuffer(doc)
}

export function buildPdfFilename(type: ReportType, companyName: string, year: number): string {
  const slug = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  const prefix: Record<ReportType, string> = {
    balance: "balance",
    "sumas-saldos": "sumas-saldos",
    pyg: "pyg",
  }

  return `${prefix[type]}-${slug}-${year}.pdf`
}
