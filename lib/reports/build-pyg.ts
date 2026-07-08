import { buildReportMeta, fetchAccountBalances } from "@/lib/reports/account-ledger"
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

function buildPygSection(title: string, rows: AccountBalance[], type: "ingreso" | "gasto"): PygSection {
  const sectionRows = rows
    .filter((row) => (type === "ingreso" ? isIngreso(row.cuenta) : isGasto(row.cuenta)))
    .map((row) => ({
      cuenta: row.cuenta,
      label: row.label,
      amount: type === "ingreso" ? ingresoAmount(row) : gastoAmount(row),
      level: row.level,
    }))
    .filter((row) => row.amount !== 0)

  return {
    title,
    rows: sectionRows,
    subtotal: round2(sectionRows.reduce((sum, row) => sum + row.amount, 0)),
  }
}

export async function buildPygReport(query: LedgerQuery): Promise<PygReportData> {
  const balances = await fetchAccountBalances(query)
  const meta = await buildReportMeta(
    query.companyId,
    "Pérdidas y Ganancias",
    query.year,
    query.fromMonth,
    query.toMonth,
  )

  const ingresos = [
    buildPygSection("Ingresos de explotación (grupo 7)", balances, "ingreso"),
  ].filter((section) => section.rows.length > 0)

  const gastos = [
    buildPygSection("Gastos de explotación (grupo 6)", balances, "gasto"),
  ].filter((section) => section.rows.length > 0)

  const totalIngresos = round2(ingresos.reduce((sum, section) => sum + section.subtotal, 0))
  const totalGastos = round2(gastos.reduce((sum, section) => sum + section.subtotal, 0))
  const resultado = round2(totalIngresos - totalGastos)

  return { meta, ingresos, gastos, totalIngresos, totalGastos, resultado }
}
