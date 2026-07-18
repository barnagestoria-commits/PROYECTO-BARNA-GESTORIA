import { filterAccountsWithMovement } from "@/lib/reports/build-sumas-saldos"
import { fetchReportData } from "@/lib/reports/fetch-report-data"
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
        row.cuenta,
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

function buildBalanceCsv(data: BalanceReportData): string {
  const lines = [
    ...metaRows(data.meta),
    csvRow(["Sección", "Subsección", "Cuenta", "Descripción", "Importe"]),
  ]

  lines.push(csvRow(["ACTIVO", "", "", "", ""]))
  for (const section of data.activo) {
    lines.push(csvRow(["", section.title, "", "", ""]))
    for (const row of section.rows) {
      lines.push(csvRow(["", "", row.cuenta, `${"  ".repeat(row.level)}${row.label}`, row.amount.toFixed(2)]))
    }
    lines.push(csvRow(["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)]))
  }
  lines.push(csvRow(["TOTAL ACTIVO", "", "", "", data.totalActivo.toFixed(2)]))
  lines.push("")

  lines.push(csvRow(["PATRIMONIO NETO Y PASIVO", "", "", "", ""]))
  for (const section of data.pasivo) {
    lines.push(csvRow(["", section.title, "", "", ""]))
    for (const row of section.rows) {
      lines.push(csvRow(["", "", row.cuenta, `${"  ".repeat(row.level)}${row.label}`, row.amount.toFixed(2)]))
    }
    lines.push(csvRow(["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)]))
  }
  lines.push(csvRow(["TOTAL PATRIMONIO NETO Y PASIVO", "", "", "", data.totalPasivo.toFixed(2)]))

  return lines.join("\n")
}

function buildPygCsv(data: PygReportData): string {
  const lines = [
    ...metaRows(data.meta),
    csvRow(["Sección", "Subsección", "Cuenta", "Descripción", "Importe"]),
  ]

  lines.push(csvRow(["INGRESOS", "", "", "", ""]))
  for (const section of data.ingresos) {
    lines.push(csvRow(["", section.title, "", "", ""]))
    for (const row of section.rows) {
      lines.push(csvRow(["", "", row.cuenta, `${"  ".repeat(row.level)}${row.label}`, row.amount.toFixed(2)]))
    }
    lines.push(csvRow(["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)]))
  }
  lines.push(csvRow(["TOTAL INGRESOS", "", "", "", data.totalIngresos.toFixed(2)]))
  lines.push("")

  lines.push(csvRow(["GASTOS", "", "", "", ""]))
  for (const section of data.gastos) {
    lines.push(csvRow(["", section.title, "", "", ""]))
    for (const row of section.rows) {
      lines.push(csvRow(["", "", row.cuenta, `${"  ".repeat(row.level)}${row.label}`, row.amount.toFixed(2)]))
    }
    lines.push(csvRow(["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)]))
  }
  lines.push(csvRow(["TOTAL GASTOS", "", "", "", data.totalGastos.toFixed(2)]))
  lines.push(csvRow(["RESULTADO DEL EJERCICIO", "", "", "", data.resultado.toFixed(2)]))

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
