import { round2 } from "@/lib/reports/format"
import type { MovementTotals } from "@/lib/reports/build-chart-balances"
import type { StatementSlice } from "@/lib/reports/statement-layout"

export interface MovementFact {
  cuenta: string
  year: number
  month: number
  debe: number
  haber: number
  distributions: Array<{ costCenterId: string; amount: number }>
}

function scaled(fact: MovementFact, ratio: number): { debe: number; haber: number } {
  return { debe: round2(fact.debe * ratio), haber: round2(fact.haber * ratio) }
}

function amountsForSlice(fact: MovementFact, slice: StatementSlice): { debe: number; haber: number } | null {
  const lineTotal = Math.max(fact.debe, fact.haber)
  if (slice.costCenterId) {
    const assigned = fact.distributions
      .filter((item) => item.costCenterId === slice.costCenterId)
      .reduce((sum, item) => sum + item.amount, 0)
    if (lineTotal <= 0 || assigned <= 0) return null
    return scaled(fact, assigned / lineTotal)
  }
  if (slice.unassignedOnly) {
    const assigned = fact.distributions.reduce((sum, item) => sum + item.amount, 0)
    const remainder = lineTotal - assigned
    if (lineTotal <= 0 || remainder <= 0.004) return null
    return scaled(fact, remainder / lineTotal)
  }
  return { debe: fact.debe, haber: fact.haber }
}

export function aggregateMovementFacts(
  facts: MovementFact[],
  slice: StatementSlice,
): Map<string, MovementTotals> {
  const map = new Map<string, MovementTotals>()
  for (const fact of facts) {
    if (fact.year !== slice.year || fact.month < slice.fromMonth || fact.month > slice.toMonth) continue
    const amounts = amountsForSlice(fact, slice)
    if (!amounts) continue
    const current = map.get(fact.cuenta) ?? { totalDebe: 0, totalHaber: 0 }
    current.totalDebe += amounts.debe
    current.totalHaber += amounts.haber
    map.set(fact.cuenta, current)
  }
  return map
}
