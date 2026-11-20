import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces"
import { createPdfBuffer } from "@/lib/reports/pdf/pdfmake-client"
import { filterAccountsWithMovement } from "@/lib/reports/build-sumas-saldos"
import { fetchReportData } from "@/lib/reports/fetch-report-data"
import { formatAmount, formatChangePercent, formatDateTimeEs, formatEuro } from "@/lib/reports/format"
import type { StatementColumn } from "@/lib/reports/statement-layout"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
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
  return { text: formatAccountCodeDisplay(cuenta), fontSize: 8 }
}

function amountCell(value: number): TableCell {
  return {
    text: formatAmount(value),
    alignment: "right",
    fontSize: 8,
    noWrap: true,
  }
}

function headerBlock(meta: ReportMeta): Content[] {
  return [
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: "TAXLYN", style: "brand", margin: [0, 0, 0, 2] },
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
    margin: [40, 0, 40, 16],
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

function statementColumns(meta: ReportMeta): StatementColumn[] {
  if (meta.columns && meta.columns.length > 0) return meta.columns
  if (meta.compareYear) {
    return [
      { id: "current", label: String(meta.year), kind: "amount" },
      { id: "compare", label: String(meta.compareYear), kind: "amount" },
    ]
  }
  return [{ id: "amount", label: "Importe", kind: "amount" }]
}

function pdfValue(column: StatementColumn, value: number | null, style: "amount" | "totalRow"): TableCell {
  const text = column.kind === "percent" ? formatChangePercent(value) : formatAmount(value ?? 0)
  return {
    text,
    style: style === "totalRow" ? "totalRow" : undefined,
    alignment: "right",
    fontSize: style === "totalRow" ? 9 : 8,
    noWrap: true,
    color: column.kind === "percent" && value !== null && value < 0 ? "#B91C1C" : undefined,
  }
}

function sectionTable(
  sections: Array<{
    title: string
    rows: Array<{ cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number }>
    subtotal: number
    compareSubtotal?: number
    subtotals?: Array<number | null>
  }>,
  columns: StatementColumn[],
  options: { includeSubtotal?: boolean } = {},
): Content[] {
  const includeSubtotal = options.includeSubtotal !== false
  const content: Content[] = []
  const valueWidth = columns.length > 6 ? 36 : 52

  for (const section of sections) {
    content.push({ text: section.title, style: "sectionTitle", margin: [0, 6, 0, 3] })

    const header: TableCell[] = [
      { text: "Cuenta", style: "tableHeader" },
      { text: "Descripción", style: "tableHeader" },
      ...columns.map((column) => ({ text: column.label, style: "tableHeader", alignment: "right" as const })),
    ]

    const body: TableCell[][] = [
      header,
      ...section.rows.map((row): TableCell[] => {
        const values = row.values && row.values.length === columns.length
          ? row.values
          : columns.map((_, index) => (index === 0 ? row.amount : row.compareAmount ?? 0))
        return [
          cuentaCell(row.cuenta),
          labelCell(row.label, row.level),
          ...columns.map((column, index) => pdfValue(column, values[index] ?? null, "amount")),
        ]
      }),
    ]

    if (includeSubtotal) {
      body.push([
        { text: `Subtotal ${section.title}`, style: "totalRow" },
        { text: "", style: "totalRow" },
        ...columns.map((column, index) =>
          pdfValue(
            column,
            section.subtotals?.[index] ?? (index === 0 ? section.subtotal : section.compareSubtotal ?? 0),
            "totalRow",
          ),
        ),
      ])
    }

    content.push({
      table: {
        headerRows: 1,
        widths: [52, "*", ...columns.map(() => valueWidth)],
        body,
        dontBreakRows: true,
      },
      layout: {
        ...tableLayout,
        fillColor: (rowIndex: number) => tableFillColor(rowIndex, body.length),
      },
      margin: [0, 0, 0, 2],
    })
  }

  return content
}

function totalLine(
  label: string,
  amount: number,
  compareAmount?: number,
  columns?: StatementColumn[],
  values?: Array<number | null>,
): Content {
  if (columns && columns.length > 1 && values) {
    return {
      columns: [
        { text: label, style: "totalRow", width: "*" },
        ...columns.map((column, index) => ({
          text: column.kind === "percent" ? formatChangePercent(values[index]) : formatEuro(values[index] ?? 0),
          style: "totalRow",
          alignment: "right" as const,
          width: 58,
        })),
      ],
      margin: [0, 6, 0, 12] as [number, number, number, number],
    }
  }
  if (compareAmount === undefined) {
    return {
      columns: [
        { text: label, style: "totalRow" },
        { text: formatEuro(amount), style: "totalRow", alignment: "right" },
      ],
      margin: [0, 6, 0, 12],
    }
  }

  return {
    columns: [
      { text: label, style: "totalRow" },
      { text: formatEuro(amount), style: "totalRow", alignment: "right", width: 70 },
      { text: formatEuro(compareAmount), style: "totalRow", alignment: "right", width: 70 },
    ],
    margin: [0, 6, 0, 12],
  }
}

function flattenSectionRows(
  sections: Array<{
    rows: Array<{ cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number }>
  }>,
): Array<{ cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number }> {
  return sections.flatMap((section) => section.rows)
}

/** Bloque vertical a ancho completo, al estilo listado A3 (Activo → Pasivo / Ingresos → Gastos). */
function statementBlock(
  title: string,
  rows: Array<{ cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number }>,
  columns: StatementColumn[],
  emptyMessage: string,
): Content[] {
  if (rows.length === 0) {
    return [
      { text: title, style: "sectionTitle", margin: [0, 4, 0, 3] },
      { text: emptyMessage, style: "empty" },
    ]
  }

  const valueWidth = columns.length > 6 ? 36 : 52
  const body: TableCell[][] = [
    [
      { text: "Cuenta", style: "tableHeader" },
      { text: "Descripción", style: "tableHeader" },
      ...columns.map((column) => ({ text: column.label, style: "tableHeader", alignment: "right" as const })),
    ],
    ...rows.map((row): TableCell[] => {
      const values = row.values && row.values.length === columns.length
        ? row.values
        : columns.map((_, index) => (index === 0 ? row.amount : row.compareAmount ?? 0))
      return [
        cuentaCell(row.cuenta),
        labelCell(row.label, row.level),
        ...columns.map((column, index) => pdfValue(column, values[index] ?? null, "amount")),
      ]
    }),
  ]

  return [
    { text: title, style: "sectionTitle", margin: [0, 4, 0, 3] },
    {
      table: {
        headerRows: 1,
        widths: [52, "*", ...columns.map(() => valueWidth)],
        body,
        dontBreakRows: true,
      },
      layout: {
        ...tableLayout,
        fillColor: (rowIndex: number) => {
          if (rowIndex === 0) return EMERALD
          return rowIndex % 2 === 0 ? ZEBRA : null
        },
      },
      margin: [0, 0, 0, 2],
    },
  ]
}

function buildBalancePdf(report: BalanceReportData): Content[] {
  const columns = statementColumns(report.meta)
  // Orden tipo A3/Zimmermann: primero todo el ACTIVO, después PATRIMONIO NETO Y PASIVO.
  return [
    { text: "ACTIVO", style: "sectionTitle", margin: [0, 0, 0, 2] },
    ...(report.activo.length > 0
      ? sectionTable(report.activo, columns)
      : [{ text: "Sin saldos de activo en el periodo.", style: "empty" }]),
    totalLine("TOTAL ACTIVO", report.totalActivo, report.totalActivoCompare, columns, report.totalActivoValues),
    { text: "PATRIMONIO NETO Y PASIVO", style: "sectionTitle", margin: [0, 10, 0, 2] },
    ...(report.pasivo.length > 0
      ? sectionTable(report.pasivo, columns)
      : [{ text: "Sin saldos de pasivo en el periodo.", style: "empty" }]),
    totalLine(
      "TOTAL PATRIMONIO NETO Y PASIVO",
      report.totalPasivo,
      report.totalPasivoCompare,
      columns,
      report.totalPasivoValues,
    ),
  ]
}

function buildPygPdf(report: PygReportData): Content[] {
  const columns = statementColumns(report.meta)
  // Orden vertical a ancho completo (como el listado A3): ingresos → gastos → resultado.
  const content: Content[] = [
    ...statementBlock(
      "INGRESOS",
      flattenSectionRows(report.ingresos),
      columns,
      "Sin ingresos registrados en el periodo.",
    ),
    totalLine(
      "TOTAL INGRESOS",
      report.totalIngresos,
      report.totalIngresosCompare,
      columns,
      report.totalIngresosValues,
    ),
    ...statementBlock(
      "GASTOS",
      flattenSectionRows(report.gastos),
      columns,
      "Sin gastos registrados en el periodo.",
    ),
    totalLine(
      "TOTAL GASTOS",
      report.totalGastos,
      report.totalGastosCompare,
      columns,
      report.totalGastosValues,
    ),
  ]

  if (columns.length > 1) {
    content.push(
      totalLine(
        "RESULTADO DEL EJERCICIO",
        report.resultado,
        report.resultadoCompare,
        columns,
        report.resultadoValues,
      ),
    )
    return content
  }

  content.push(
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
    },
  )

  return content
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

  const wide = (meta.columns?.length ?? 0) > 4
  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: wide ? "landscape" : "portrait",
    pageMargins: [40, 36, 40, 48],
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
