import { filterAccountsWithMovement } from "@/lib/reports/build-sumas-saldos"
import { fetchReportData } from "@/lib/reports/fetch-report-data"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { formatChangePercent } from "@/lib/reports/format"
import type { StatementColumn } from "@/lib/reports/statement-layout"
import type { LedgerQuery } from "@/lib/reports/account-ledger"
import type {
  BalanceReportData,
  PygReportData,
  ReportMeta,
  ReportType,
  SumasSaldosReportData,
} from "@/lib/reports/types"

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

function metaRows(meta: ReportMeta): string[] {
  return [
    csvRow(["Empresa", meta.companyName]),
    csvRow(["NIF", meta.companyCif ?? ""]),
    csvRow(["Ejercicio", meta.year]),
    csvRow(["Periodo", meta.periodLabel]),
    csvRow(["Informe", meta.reportTitle]),
    "",
  ]
}

function buildSumasSaldosCsv(data: SumasSaldosReportData): string {
  const rows = filterAccountsWithMovement(data.rows)
  const lines = [
    ...metaRows(data.meta),
    csvRow(["Cuenta", "Descripción", "Debe", "Haber", "Saldo"]),
    ...rows.map((row) =>
      csvRow([
        formatAccountCodeDisplay(row.cuenta),
        `${"  ".repeat(row.level)}${row.label}`,
        row.totalDebe.toFixed(2),
        row.totalHaber.toFixed(2),
        row.saldo.toFixed(2),
      ]),
    ),
    csvRow(["TOTALES", "", data.totalDebe.toFixed(2), data.totalHaber.toFixed(2), (data.totalDebe - data.totalHaber).toFixed(2)]),
  ]
  return lines.join("\n")
}

function csvColumns(meta: ReportMeta): StatementColumn[] {
  if (meta.columns && meta.columns.length > 0) return meta.columns
  if (meta.compareYear) {
    return [
      { id: "current", label: String(meta.year), kind: "amount" },
      { id: "compare", label: String(meta.compareYear), kind: "amount" },
    ]
  }
  return [{ id: "amount", label: "Importe", kind: "amount" }]
}

function statementHeader(columns: StatementColumn[]): string[] {
  return ["Sección", "Subsección", "Cuenta", "Descripción", ...columns.map((column) => column.label)]
}

function formatColumnValue(column: StatementColumn, value: number | null): string {
  if (column.kind === "percent") return formatChangePercent(value)
  return (value ?? 0).toFixed(2)
}

function statementCells(
  row: { cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number },
  columns: StatementColumn[],
): string[] {
  const values = row.values && row.values.length === columns.length
    ? row.values
    : columns.map((_, index) => (index === 0 ? row.amount : row.compareAmount ?? 0))
  return [
    "",
    "",
    formatAccountCodeDisplay(row.cuenta),
    `${"  ".repeat(row.level)}${row.label}`,
    ...columns.map((column, index) => formatColumnValue(column, values[index] ?? null)),
  ]
}

function totalCells(label: string, columns: StatementColumn[], values: Array<number | null>): string[] {
  return [label, "", "", "", ...columns.map((column, index) => formatColumnValue(column, values[index] ?? null))]
}

function buildBalanceCsv(data: BalanceReportData): string {
  const columns = csvColumns(data.meta)
  const lines = [...metaRows(data.meta), csvRow(statementHeader(columns))]

  lines.push(csvRow(["ACTIVO"]))
  for (const section of data.activo) {
    lines.push(csvRow(["", section.title]))
    for (const row of section.rows) lines.push(csvRow(statementCells(row, columns)))
    lines.push(csvRow(totalCells(`Subtotal ${section.title}`, columns, section.subtotals ?? [section.subtotal])))
  }
  lines.push(csvRow(totalCells("TOTAL ACTIVO", columns, data.totalActivoValues ?? [data.totalActivo])))
  lines.push("")
  lines.push(csvRow(["PATRIMONIO NETO Y PASIVO"]))
  for (const section of data.pasivo) {
    lines.push(csvRow(["", section.title]))
    for (const row of section.rows) lines.push(csvRow(statementCells(row, columns)))
    lines.push(csvRow(totalCells(`Subtotal ${section.title}`, columns, section.subtotals ?? [section.subtotal])))
  }
  lines.push(
    csvRow(totalCells("TOTAL PATRIMONIO NETO Y PASIVO", columns, data.totalPasivoValues ?? [data.totalPasivo])),
  )

  return lines.join("\n")
}

function buildPygCsv(data: PygReportData): string {
  const columns = csvColumns(data.meta)
  const lines = [...metaRows(data.meta), csvRow(statementHeader(columns))]

  const appendSections = (
    title: string,
    sections: PygReportData["ingresos"],
    totalLabel: string,
    totals: Array<number | null>,
  ) => {
    lines.push(csvRow([title]))
    for (const section of sections) {
      lines.push(csvRow(["", section.title]))
      for (const row of section.rows) lines.push(csvRow(statementCells(row, columns)))
      lines.push(csvRow(totalCells(`Subtotal ${section.title}`, columns, section.subtotals ?? [section.subtotal])))
    }
    lines.push(csvRow(totalCells(totalLabel, columns, totals)))
  }

  appendSections("INGRESOS", data.ingresos, "TOTAL INGRESOS", data.totalIngresosValues ?? [data.totalIngresos])
  lines.push("")
  appendSections("GASTOS", data.gastos, "TOTAL GASTOS", data.totalGastosValues ?? [data.totalGastos])
  lines.push(csvRow(totalCells("RESULTADO DEL EJERCICIO", columns, data.resultadoValues ?? [data.resultado])))

  return lines.join("\n")
}

export async function generateReportCsv(type: ReportType, query: LedgerQuery): Promise<Buffer> {
  const report = await fetchReportData(type, query)
  let content: string

  switch (report.type) {
    case "sumas-saldos":
      content = buildSumasSaldosCsv(report.data)
      break
    case "balance":
      content = buildBalanceCsv(report.data)
      break
    case "pyg":
      content = buildPygCsv(report.data)
      break
  }

  return Buffer.from(`\uFEFF${content}`, "utf-8")
}
