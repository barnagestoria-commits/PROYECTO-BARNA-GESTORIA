import ExcelJS from "exceljs"
import { filterAccountsWithMovement } from "@/lib/reports/build-sumas-saldos"
import { fetchReportData } from "@/lib/reports/fetch-report-data"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import type { LedgerQuery } from "@/lib/reports/account-ledger"
import type { StatementColumn } from "@/lib/reports/statement-layout"
import type {
  BalanceReportData,
  PygReportData,
  ReportMeta,
  ReportType,
  SumasSaldosReportData,
} from "@/lib/reports/types"

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF145A32" },
}

const SUBTOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFECFDF5" },
}

function styleHeaderRow(row: ExcelJS.Row, columns: number) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
  row.fill = HEADER_FILL
  row.alignment = { vertical: "middle" }
  for (let col = 1; col <= columns; col++) {
    row.getCell(col).border = {
      bottom: { style: "thin", color: { argb: "FF0F3D2E" } },
    }
  }
}

function styleSubtotalRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF0F3D2E" }, size: 10 }
  row.fill = SUBTOTAL_FILL
}

function addMetaHeader(sheet: ExcelJS.Worksheet, meta: ReportMeta) {
  sheet.mergeCells("A1:E1")
  sheet.getCell("A1").value = "BARNA GESTORÍA"
  sheet.getCell("A1").font = { bold: true, color: { argb: "FF145A32" }, size: 10 }

  sheet.mergeCells("A2:E2")
  sheet.getCell("A2").value = meta.reportTitle
  sheet.getCell("A2").font = { bold: true, size: 14, color: { argb: "FF0F3D2E" } }

  sheet.getCell("A4").value = "Empresa"
  sheet.getCell("B4").value = meta.companyName
  sheet.getCell("A5").value = "NIF"
  sheet.getCell("B5").value = meta.companyCif ?? "—"
  sheet.getCell("A6").value = "Ejercicio"
  sheet.getCell("B6").value = meta.year
  sheet.getCell("A7").value = "Periodo"
  sheet.getCell("B7").value = meta.periodLabel

  sheet.getColumn(1).width = 14
  sheet.getColumn(2).width = 36
}

function buildSumasSaldosSheet(workbook: ExcelJS.Workbook, data: SumasSaldosReportData) {
  const rows = filterAccountsWithMovement(data.rows)
  const sheet = workbook.addWorksheet("Sumas y Saldos")

  addMetaHeader(sheet, data.meta)
  const startRow = 9
  const header = sheet.getRow(startRow)
  header.values = ["Cuenta", "Descripción", "Debe", "Haber", "Saldo"]
  styleHeaderRow(header, 5)

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(startRow + 1 + index)
    excelRow.values = [
      formatAccountCodeDisplay(row.cuenta),
      `${"  ".repeat(row.level)}${row.label}`,
      row.totalDebe,
      row.totalHaber,
      row.saldo,
    ]
    excelRow.getCell(3).numFmt = "#,##0.00"
    excelRow.getCell(4).numFmt = "#,##0.00"
    excelRow.getCell(5).numFmt = "#,##0.00"
  })

  const totalRow = sheet.getRow(startRow + 1 + rows.length)
  totalRow.values = [
    "TOTALES",
    "",
    data.totalDebe,
    data.totalHaber,
    data.totalDebe - data.totalHaber,
  ]
  styleSubtotalRow(totalRow)
  totalRow.getCell(3).numFmt = "#,##0.00"
  totalRow.getCell(4).numFmt = "#,##0.00"
  totalRow.getCell(5).numFmt = "#,##0.00"

  sheet.getColumn(3).width = 14
  sheet.getColumn(4).width = 14
  sheet.getColumn(5).width = 14
}

function excelColumns(meta: ReportMeta): StatementColumn[] {
  if (meta.columns && meta.columns.length > 0) return meta.columns
  if (meta.compareYear) {
    return [
      { id: "current", label: String(meta.year), kind: "amount" },
      { id: "compare", label: String(meta.compareYear), kind: "amount" },
    ]
  }
  return [{ id: "amount", label: "Importe", kind: "amount" }]
}

function writeValueCells(
  row: ExcelJS.Row,
  columns: StatementColumn[],
  values: Array<number | null>,
) {
  columns.forEach((column, index) => {
    const cell = row.getCell(3 + index)
    const value = values[index]
    if (column.kind === "percent") {
      cell.value = value === null ? "—" : value / 100
      if (value !== null) cell.numFmt = '+0.00%;-0.00%;0.00%'
      return
    }
    cell.value = value ?? 0
    cell.numFmt = "#,##0.00"
  })
}

function addSectionRows(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  sectionTitle: string,
  sections: Array<{
    title: string
    rows: Array<{ cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number }>
    subtotal: number
    compareSubtotal?: number
    subtotals?: Array<number | null>
  }>,
  columns: StatementColumn[],
): number {
  let rowIndex = startRow
  sheet.getRow(rowIndex).values = [sectionTitle]
  sheet.getRow(rowIndex).font = { bold: true, color: { argb: "FF0F3D2E" }, size: 11 }
  rowIndex++

  for (const section of sections) {
    sheet.getRow(rowIndex).values = [section.title]
    sheet.getRow(rowIndex).font = { bold: true, size: 10 }
    rowIndex++

    const header = sheet.getRow(rowIndex)
    header.values = ["Cuenta", "Descripción", ...columns.map((column) => column.label)]
    styleHeaderRow(header, 2 + columns.length)
    rowIndex++

    for (const row of section.rows) {
      const excelRow = sheet.getRow(rowIndex)
      excelRow.getCell(1).value = formatAccountCodeDisplay(row.cuenta)
      excelRow.getCell(2).value = `${"  ".repeat(row.level)}${row.label}`
      const values = row.values && row.values.length === columns.length
        ? row.values
        : columns.map((_, index) => (index === 0 ? row.amount : row.compareAmount ?? 0))
      writeValueCells(excelRow, columns, values)
      rowIndex++
    }

    const subtotal = sheet.getRow(rowIndex)
    subtotal.getCell(1).value = `Subtotal ${section.title}`
    writeValueCells(
      subtotal,
      columns,
      section.subtotals ?? columns.map((_, index) => (index === 0 ? section.subtotal : section.compareSubtotal ?? 0)),
    )
    styleSubtotalRow(subtotal)
    rowIndex += 2
  }

  return rowIndex
}

function writeTotalRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  label: string,
  columns: StatementColumn[],
  values: Array<number | null>,
) {
  const row = sheet.getRow(rowIndex)
  row.getCell(1).value = label
  writeValueCells(row, columns, values)
  row.font = { bold: true, size: 11, color: { argb: "FF0F3D2E" } }
}

function buildBalanceSheet(workbook: ExcelJS.Workbook, data: BalanceReportData) {
  const sheet = workbook.addWorksheet("Balance")
  const columns = excelColumns(data.meta)

  addMetaHeader(sheet, data.meta)
  let rowIndex = addSectionRows(sheet, 9, "ACTIVO", data.activo, columns)
  writeTotalRow(sheet, rowIndex, "TOTAL ACTIVO", columns, data.totalActivoValues ?? [data.totalActivo])
  rowIndex += 2
  rowIndex = addSectionRows(sheet, rowIndex, "PATRIMONIO NETO Y PASIVO", data.pasivo, columns)
  writeTotalRow(
    sheet,
    rowIndex,
    "TOTAL PATRIMONIO NETO Y PASIVO",
    columns,
    data.totalPasivoValues ?? [data.totalPasivo],
  )

  columns.forEach((_, index) => {
    sheet.getColumn(3 + index).width = 16
  })
}

function buildPygSheet(workbook: ExcelJS.Workbook, data: PygReportData) {
  const sheet = workbook.addWorksheet("PyG")
  const columns = excelColumns(data.meta)

  addMetaHeader(sheet, data.meta)
  let rowIndex = addSectionRows(sheet, 9, "INGRESOS", data.ingresos, columns)
  writeTotalRow(sheet, rowIndex, "TOTAL INGRESOS", columns, data.totalIngresosValues ?? [data.totalIngresos])
  rowIndex += 2
  rowIndex = addSectionRows(sheet, rowIndex, "GASTOS", data.gastos, columns)
  writeTotalRow(sheet, rowIndex, "TOTAL GASTOS", columns, data.totalGastosValues ?? [data.totalGastos])
  rowIndex += 2
  writeTotalRow(sheet, rowIndex, "RESULTADO DEL EJERCICIO", columns, data.resultadoValues ?? [data.resultado])

  columns.forEach((_, index) => {
    sheet.getColumn(3 + index).width = 16
  })
}

export async function generateReportXlsx(type: ReportType, query: LedgerQuery): Promise<Buffer> {
  const report = await fetchReportData(type, query)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Barna Gestoría"
  workbook.created = new Date()

  switch (report.type) {
    case "sumas-saldos":
      buildSumasSaldosSheet(workbook, report.data)
      break
    case "balance":
      buildBalanceSheet(workbook, report.data)
      break
    case "pyg":
      buildPygSheet(workbook, report.data)
      break
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
