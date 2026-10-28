import { normalizeCuenta, round2 } from "@/lib/reports/format"
import type { StatementRow } from "@/lib/reports/types"

export interface ComparableRow {
  cuenta: string
  label: string
  level: number
  amount: number
}

export function mergeComparedAmounts(current: ComparableRow[], previous: ComparableRow[]): StatementRow[] {
  const previousByAccount = new Map(previous.map((row) => [normalizeCuenta(row.cuenta), row]))
  const seen = new Set<string>()
  const rows: StatementRow[] = []

  for (const row of current) {
    const key = normalizeCuenta(row.cuenta)
    seen.add(key)
    const compareAmount = previousByAccount.get(key)?.amount ?? 0
    if (row.amount === 0 && compareAmount === 0) continue
    rows.push({ ...row, compareAmount })
  }

  for (const row of previous) {
    const key = normalizeCuenta(row.cuenta)
    if (seen.has(key) || row.amount === 0) continue
    rows.push({
      cuenta: row.cuenta,
      label: row.label,
      level: row.level,
      amount: 0,
      compareAmount: row.amount,
    })
  }

  return rows
}

export function sumAmounts(rows: Array<{ amount: number; compareAmount?: number }>): {
  subtotal: number
  compareSubtotal: number
} {
  return {
    subtotal: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
    compareSubtotal: round2(rows.reduce((sum, row) => sum + (row.compareAmount ?? 0), 0)),
  }
}
