import { buildReportMeta, fetchAccountBalances } from "@/lib/reports/account-ledger"
import { mergeComparedAmounts, sumAmounts, type ComparableRow } from "@/lib/reports/compare-years"
import { normalizeCuenta, round2 } from "@/lib/reports/format"
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

function buildPygSection(
  title: string,
  rows: AccountBalance[],
  type: "ingreso" | "gasto",
  compareRows: AccountBalance[] | null,
): PygSection {
  const current = rowsForType(rows, type)
  const merged = compareRows
    ? mergeComparedAmounts(current, rowsForType(compareRows, type))
    : current.filter((row) => row.amount !== 0)
  const totals = sumAmounts(merged)

  return {
    title,
    rows: merged,
    subtotal: totals.subtotal,
    compareSubtotal: compareRows ? totals.compareSubtotal : undefined,
  }
}

export async function buildPygReport(query: LedgerQuery): Promise<PygReportData> {
  const balances = await fetchAccountBalances(query)
  const compareYear = query.compareYear && query.compareYear !== query.year ? query.compareYear : null
  const compareBalances = compareYear
    ? await fetchAccountBalances({ ...query, year: compareYear, compareYear: null })
    : null
  const meta = await buildReportMeta(
    query.companyId,
    "Pérdidas y Ganancias",
    query.year,
    query.fromMonth,
    query.toMonth,
  )
  meta.compareYear = compareYear

  const ingresos = [
    buildPygSection("Ingresos de explotación (grupo 7)", balances, "ingreso", compareBalances),
  ].filter((section) => section.rows.length > 0)

  const gastos = [
    buildPygSection("Gastos de explotación (grupo 6)", balances, "gasto", compareBalances),
  ].filter((section) => section.rows.length > 0)

  const totalIngresos = round2(ingresos.reduce((sum, section) => sum + section.subtotal, 0))
  const totalGastos = round2(gastos.reduce((sum, section) => sum + section.subtotal, 0))
  const resultado = round2(totalIngresos - totalGastos)
  const totalIngresosCompare = compareBalances
    ? round2(ingresos.reduce((sum, section) => sum + (section.compareSubtotal ?? 0), 0))
    : undefined
  const totalGastosCompare = compareBalances
    ? round2(gastos.reduce((sum, section) => sum + (section.compareSubtotal ?? 0), 0))
    : undefined

  return {
    meta,
    ingresos,
    gastos,
    totalIngresos,
    totalGastos,
    resultado,
    totalIngresosCompare,
    totalGastosCompare,
    resultadoCompare:
      totalIngresosCompare !== undefined && totalGastosCompare !== undefined
        ? round2(totalIngresosCompare - totalGastosCompare)
        : undefined,
  }
}
