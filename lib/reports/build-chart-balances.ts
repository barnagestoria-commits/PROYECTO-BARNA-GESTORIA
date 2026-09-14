import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import {
  expandPlanCodesForDetail,
  getChartAccountName,
} from "@/lib/reports/pgc-chart-plans"
import {
  cuentaSortKey,
  getAccountLevel,
  normalizeCuenta,
  round2,
} from "@/lib/reports/format"
import type { AccountBalance } from "@/lib/reports/types"

export interface MovementTotals {
  totalDebe: number
  totalHaber: number
}

export interface OpenedChartAccount {
  code: string
  name: string
}

function toChartKey(cuenta: string, detailLevel: GestoriaAccountDetailLevel): string {
  const digits = normalizeCuenta(cuenta)
  if (!digits) return ""
  if (detailLevel === "SUBCUENTAS") return digits
  if (detailLevel === "NIVEL_4") return digits.length <= 4 ? digits : digits.slice(0, 4)
  return digits.length <= 3 ? digits : digits.slice(0, 3)
}

export function aggregateMovementsByDetail(
  movements: Map<string, MovementTotals>,
  detailLevel: GestoriaAccountDetailLevel,
): Map<string, MovementTotals> {
  const aggregated = new Map<string, MovementTotals>()

  const add = (key: string, totals: MovementTotals) => {
    const current = aggregated.get(key) ?? { totalDebe: 0, totalHaber: 0 }
    current.totalDebe += totals.totalDebe
    current.totalHaber += totals.totalHaber
    aggregated.set(key, current)
  }

  for (const [cuenta, totals] of movements) {
    const code = normalizeCuenta(cuenta)
    if (!code) continue
    if (code.length > 3 || detailLevel === "SUBCUENTAS") {
      add(code, totals)
      continue
    }
    add(toChartKey(code, detailLevel), totals)
  }
  return aggregated
}

export function buildChartBalanceRows(input: {
  planCodes: string[]
  openedAccounts: OpenedChartAccount[]
  movements: Map<string, MovementTotals>
  detailLevel: GestoriaAccountDetailLevel
}): AccountBalance[] {
  const planCodes = expandPlanCodesForDetail(input.planCodes, input.detailLevel)
  const aggregated = aggregateMovementsByDetail(input.movements, input.detailLevel)
  const rows = new Map<string, AccountBalance>()

  const upsert = (cuenta: string, label: string, preferLabel = false) => {
    const code = normalizeCuenta(cuenta)
    if (!code) return
    const totals = aggregated.get(code) ?? { totalDebe: 0, totalHaber: 0 }
    const existing = rows.get(code)
    if (existing && !preferLabel) return
    rows.set(code, {
      cuenta: code,
      label: preferLabel && label.trim() ? label.trim() : existing?.label ?? label,
      totalDebe: round2(totals.totalDebe),
      totalHaber: round2(totals.totalHaber),
      saldo: round2(totals.totalDebe - totals.totalHaber),
      level: getAccountLevel(code),
    })
  }

  for (const code of planCodes) {
    upsert(code, getChartAccountName(code))
  }

  for (const opened of input.openedAccounts) {
    upsert(opened.code, opened.name, true)
  }

  for (const cuenta of aggregated.keys()) {
    upsert(cuenta, getChartAccountName(cuenta))
  }

  return [...rows.values()].sort((a, b) =>
    cuentaSortKey(a.cuenta).localeCompare(cuentaSortKey(b.cuenta)),
  )
}

export function countAccountsWithMovement(rows: AccountBalance[]): number {
  return rows.filter((row) => row.totalDebe !== 0 || row.totalHaber !== 0 || row.saldo !== 0).length
}
