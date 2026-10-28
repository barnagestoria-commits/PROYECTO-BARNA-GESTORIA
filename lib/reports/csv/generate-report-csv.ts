import { filterAccountsWithMovement } from "@/lib/reports/build-sumas-saldos"
import { fetchReportData } from "@/lib/reports/fetch-report-data"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
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

function statementHeader(year: number, compareYear?: number | null): string[] {
  return compareYear
    ? ["Sección", "Subsección", "Cuenta", "Descripción", String(year), String(compareYear)]
    : ["Sección", "Subsección", "Cuenta", "Descripción", "Importe"]
}

function statementCells(
  row: { cuenta: string; label: string; amount: number; compareAmount?: number; level: number },
  compareYear?: number | null,
): string[] {
  const cells = ["", "", formatAccountCodeDisplay(row.cuenta), `${"  ".repeat(row.level)}${row.label}`, row.amount.toFixed(2)]
  if (compareYear) cells.push((row.compareAmount ?? 0).toFixed(2))
  return cells
}

function buildBalanceCsv(data: BalanceReportData): string {
  const compareYear = data.meta.compareYear
  const lines = [
    ...metaRows(data.meta),
    csvRow(statementHeader(data.meta.year, compareYear)),
  ]

  lines.push(csvRow(["ACTIVO", "", "", "", ""]))
  for (const section of data.activo) {
    lines.push(csvRow(["", section.title, "", "", ""]))
    for (const row of section.rows) {
      lines.push(csvRow(statementCells(row, compareYear)))
    }
    lines.push(
      csvRow(
        compareYear
          ? ["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2), (section.compareSubtotal ?? 0).toFixed(2)]
          : ["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)],
      ),
    )
  }
  lines.push(
    csvRow(
      compareYear
        ? ["TOTAL ACTIVO", "", "", "", data.totalActivo.toFixed(2), (data.totalActivoCompare ?? 0).toFixed(2)]
        : ["TOTAL ACTIVO", "", "", "", data.totalActivo.toFixed(2)],
    ),
  )
  lines.push("")

  lines.push(csvRow(["PATRIMONIO NETO Y PASIVO", "", "", "", ""]))
  for (const section of data.pasivo) {
    lines.push(csvRow(["", section.title, "", "", ""]))
    for (const row of section.rows) {
      lines.push(csvRow(statementCells(row, compareYear)))
    }
    lines.push(
      csvRow(
        compareYear
          ? ["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2), (section.compareSubtotal ?? 0).toFixed(2)]
          : ["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)],
      ),
    )
  }
  lines.push(
    csvRow(
      compareYear
        ? ["TOTAL PATRIMONIO NETO Y PASIVO", "", "", "", data.totalPasivo.toFixed(2), (data.totalPasivoCompare ?? 0).toFixed(2)]
        : ["TOTAL PATRIMONIO NETO Y PASIVO", "", "", "", data.totalPasivo.toFixed(2)],
    ),
  )

  return lines.join("\n")
}

function buildPygCsv(data: PygReportData): string {
  const compareYear = data.meta.compareYear
  const lines = [
    ...metaRows(data.meta),
    csvRow(statementHeader(data.meta.year, compareYear)),
  ]

  const appendSections = (
    title: string,
    sections: PygReportData["ingresos"],
    totalLabel: string,
    total: number,
    totalCompare?: number,
  ) => {
    lines.push(csvRow([title, "", "", "", ""]))
    for (const section of sections) {
      lines.push(csvRow(["", section.title, "", "", ""]))
      for (const row of section.rows) lines.push(csvRow(statementCells(row, compareYear)))
      lines.push(
        csvRow(
          compareYear
            ? ["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2), (section.compareSubtotal ?? 0).toFixed(2)]
            : ["", `Subtotal ${section.title}`, "", "", section.subtotal.toFixed(2)],
        ),
      )
    }
    lines.push(
      csvRow(
        compareYear
          ? [totalLabel, "", "", "", total.toFixed(2), (totalCompare ?? 0).toFixed(2)]
          : [totalLabel, "", "", "", total.toFixed(2)],
      ),
    )
  }

  appendSections("INGRESOS", data.ingresos, "TOTAL INGRESOS", data.totalIngresos, data.totalIngresosCompare)
  lines.push("")
  appendSections("GASTOS", data.gastos, "TOTAL GASTOS", data.totalGastos, data.totalGastosCompare)
  lines.push(
    csvRow(
      compareYear
        ? ["RESULTADO DEL EJERCICIO", "", "", "", data.resultado.toFixed(2), (data.resultadoCompare ?? 0).toFixed(2)]
        : ["RESULTADO DEL EJERCICIO", "", "", "", data.resultado.toFixed(2)],
    ),
  )

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
