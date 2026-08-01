import { normalizeCuenta, round2 } from "@/lib/reports/format"
import type { AccountTotals } from "@/lib/accounting/import-validation"

export function isIngresoAccount(cuenta: string): boolean {
  return normalizeCuenta(cuenta).startsWith("7")
}

export function isGastoAccount(cuenta: string): boolean {
  return normalizeCuenta(cuenta).startsWith("6")
}

export function ingresoAmount(row: Pick<AccountTotals, "totalDebe" | "totalHaber">): number {
  return round2(row.totalHaber - row.totalDebe)
}

export function gastoAmount(row: Pick<AccountTotals, "totalDebe" | "totalHaber">): number {
  return round2(row.totalDebe - row.totalHaber)
}

export function calculatePygFromAccountTotals(rows: AccountTotals[]): {
  totalIngresos: number
  totalGastos: number
  resultado: number
} {
  const totalIngresos = round2(
    rows.filter((row) => isIngresoAccount(row.cuenta)).reduce((sum, row) => sum + ingresoAmount(row), 0),
  )
  const totalGastos = round2(
    rows.filter((row) => isGastoAccount(row.cuenta)).reduce((sum, row) => sum + gastoAmount(row), 0),
  )

  return {
    totalIngresos,
    totalGastos,
    resultado: round2(totalIngresos - totalGastos),
  }
}
