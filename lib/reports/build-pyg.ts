import { buildReportMeta } from "@/lib/reports/account-ledger"
import type { ComparableRow } from "@/lib/reports/compare-years"
import { normalizeCuenta, round2 } from "@/lib/reports/format"
import { loadStatementSource } from "@/lib/reports/statement-source"
import {
  combineAmountTotals,
  mergeColumnRows,
  pruneOptionalColumns,
  subtractAmountTotals,
  type StatementColumn,
} from "@/lib/reports/statement-layout"
import type { AccountBalance, PygReportData, PygSection } from "@/lib/reports/types"
import type { LedgerQuery } from "@/lib/reports/account-ledger"

function isIngreso(cuenta: string): boolean {
  return normalizeCuenta(cuenta).startsWith("7")
}

function isGasto(cuenta: string): boolean {
  return normalizeCuenta(cuenta).startsWith("6")
}

function ingresoAmount(row: AccountBalance): number {
  return round2(row.totalHaber - row.totalDebe)
}

function gastoAmount(row: AccountBalance): number {
  return round2(row.totalDebe - row.totalHaber)
}

function rowsForType(rows: AccountBalance[], type: "ingreso" | "gasto"): ComparableRow[] {
  return rows
    .filter((row) => (type === "ingreso" ? isIngreso(row.cuenta) : isGasto(row.cuenta)))
    .map((row) => ({
      cuenta: row.cuenta,
      label: row.label,
      amount: type === "ingreso" ? ingresoAmount(row) : gastoAmount(row),
      level: row.level,
    }))
}

function compareValue(columns: StatementColumn[], totals: Array<number | null>): number | undefined {
  const percent = columns.find((column) => column.kind === "percent")
  if (!percent || percent.baseIndex === undefined) return undefined
  return totals[percent.baseIndex] ?? 0
}

function buildPygSection(
  title: string,
  type: "ingreso" | "gasto",
  source: Awaited<ReturnType<typeof loadStatementSource>>,
): PygSection {
  const bySlice = new Map<string, ComparableRow[]>()
  for (const slice of source.layout.slices) {
    bySlice.set(slice.id, rowsForType(source.slices.get(slice.id) ?? [], type))
  }
  const merged = mergeColumnRows(source.layout.columns, bySlice)
  return {
    title,
    rows: merged.rows,
    subtotal: merged.totals[0] ?? 0,
    subtotals: merged.totals,
  }
}

export async function buildPygReport(query: LedgerQuery): Promise<PygReportData> {
  const source = await loadStatementSource(query, "pyg")
  const meta = await buildReportMeta(query.companyId, "Pérdidas y Ganancias", query.year, query.fromMonth, query.toMonth)
  meta.compareYear = source.layout.compareYear
  meta.periodLabel = source.layout.periodLabel

  const drafted = [
    buildPygSection("Ingresos de explotación (grupo 7)", "ingreso", source),
    buildPygSection("Gastos de explotación (grupo 6)", "gasto", source),
  ]
  const pruned = pruneOptionalColumns(
    source.layout.columns,
    drafted.map((section) => ({ rows: section.rows, totals: section.subtotals ?? [] })),
  )
  meta.columns = pruned.columns
  const finished = drafted.map((section, index) => {
    const group = pruned.groups[index]
    return {
      ...section,
      rows: group?.rows ?? section.rows,
      subtotals: group?.totals,
      subtotal: group?.totals[0] ?? section.subtotal,
      compareSubtotal: group ? compareValue(pruned.columns, group.totals) : undefined,
    }
  })
  const ingresos = finished.slice(0, 1).filter((section) => section.rows.length > 0)
  const gastos = finished.slice(1).filter((section) => section.rows.length > 0)
  const totalIngresosValues = combineAmountTotals(
    pruned.columns,
    ingresos.map((section) => section.subtotals ?? []),
  )
  const totalGastosValues = combineAmountTotals(
    pruned.columns,
    gastos.map((section) => section.subtotals ?? []),
  )
  const resultadoValues = subtractAmountTotals(pruned.columns, totalIngresosValues, totalGastosValues)

  return {
    meta,
    ingresos,
    gastos,
    totalIngresos: round2(totalIngresosValues[0] ?? 0),
    totalGastos: round2(totalGastosValues[0] ?? 0),
    resultado: round2(resultadoValues[0] ?? 0),
    totalIngresosCompare: compareValue(pruned.columns, totalIngresosValues),
    totalGastosCompare: compareValue(pruned.columns, totalGastosValues),
    resultadoCompare: compareValue(pruned.columns, resultadoValues),
    totalIngresosValues,
    totalGastosValues,
    resultadoValues,
  }
}
