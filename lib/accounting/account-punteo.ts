import { cuentaSortKey, normalizeCuenta, round2 } from "@/lib/reports/format"

export type PunteoFilter = "ambos" | "punteados" | "no-punteados"
export type PunteoMove = "prev" | "next" | "first" | "last"

export interface PunteoWindow {
  fromDate: string
  toDate: string
  fromAmount: number
  toAmount: number
}

export interface PunteoLineView {
  fecha: string
  debe: number
  haber: number
  punteado: boolean
}

export interface PunteoAccountCounts {
  cuenta: string
  tickedCount: number
  untickedCount: number
}

export interface PunteoAccountOption extends PunteoAccountCounts {
  formattedCuenta: string
  label: string
}

export interface PunteoBalanceRow {
  saldoInicial: number
  acumDebe: number
  acumHaber: number
  saldoFinal: number
}

export interface StoredPunteo {
  punteado: boolean
  punteadoAt: Date | null
}

export function parsePunteoAmount(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".")
  if (!normalized) return 0
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return round2(parsed)
}

export function movementAmount(line: { debe: number; haber: number }): number {
  if (line.debe > 0 && line.haber <= 0) return line.debe
  if (line.haber > 0 && line.debe <= 0) return line.haber
  return round2(Math.max(line.debe, line.haber))
}

export function dateInWindow(fecha: string, fromDate: string, toDate: string): boolean {
  if (fromDate && fecha < fromDate) return false
  if (toDate && fecha > toDate) return false
  return true
}

export function amountInWindow(amount: number, fromAmount: number, toAmount: number): boolean {
  if (fromAmount > 0 && amount < fromAmount - 0.001) return false
  if (toAmount > 0 && amount > toAmount + 0.001) return false
  return true
}

export function lineInPunteoWindow(line: PunteoLineView, window: PunteoWindow): boolean {
  return (
    dateInWindow(line.fecha, window.fromDate, window.toDate) &&
    amountInWindow(movementAmount(line), window.fromAmount, window.toAmount)
  )
}

export function lineVisibleInPunteo(
  line: PunteoLineView,
  window: PunteoWindow,
  filter: PunteoFilter,
): boolean {
  if (!lineInPunteoWindow(line, window)) return false
  if (filter === "punteados") return line.punteado
  if (filter === "no-punteados") return !line.punteado
  return true
}

export function accountMatchesPunteoFilter(
  account: PunteoAccountCounts,
  filter: PunteoFilter,
): boolean {
  if (filter === "no-punteados") return account.untickedCount > 0
  if (filter === "punteados") return account.tickedCount > 0
  return account.tickedCount + account.untickedCount > 0
}

export function movePunteoAccount(
  accounts: PunteoAccountCounts[],
  current: string,
  direction: PunteoMove,
  filter: PunteoFilter,
): string | null {
  const eligible = accounts.filter((account) => accountMatchesPunteoFilter(account, filter))
  if (eligible.length === 0) return null
  if (direction === "first") return eligible[0].cuenta
  if (direction === "last") return eligible[eligible.length - 1].cuenta

  const currentKey = cuentaSortKey(current)
  const index = eligible.findIndex((account) => cuentaSortKey(account.cuenta) === currentKey)

  if (direction === "next") {
    if (index === -1) {
      return eligible.find((account) => cuentaSortKey(account.cuenta) > currentKey)?.cuenta ?? null
    }
    return eligible[index + 1]?.cuenta ?? null
  }

  if (index === -1) {
    for (let cursor = eligible.length - 1; cursor >= 0; cursor -= 1) {
      if (cuentaSortKey(eligible[cursor].cuenta) < currentKey) return eligible[cursor].cuenta
    }
    return null
  }

  return eligible[index - 1]?.cuenta ?? null
}

export function groupPunteoAccounts(
  lines: Array<PunteoLineView & { cuenta: string }>,
  window: PunteoWindow,
): PunteoAccountCounts[] {
  const grouped = new Map<string, { ticked: number; unticked: number }>()

  for (const line of lines) {
    if (!lineInPunteoWindow(line, window)) continue
    const cuenta = normalizeCuenta(line.cuenta)
    if (cuenta.length < 2) continue
    const current = grouped.get(cuenta) ?? { ticked: 0, unticked: 0 }
    if (line.punteado) current.ticked += 1
    else current.unticked += 1
    grouped.set(cuenta, current)
  }

  return [...grouped.entries()]
    .map(([cuenta, counts]) => ({
      cuenta,
      tickedCount: counts.ticked,
      untickedCount: counts.unticked,
    }))
    .sort((a, b) => cuentaSortKey(a.cuenta).localeCompare(cuentaSortKey(b.cuenta)))
}

function balanceRow(saldoInicial: number, acumDebe: number, acumHaber: number): PunteoBalanceRow {
  return {
    saldoInicial: round2(saldoInicial),
    acumDebe: round2(acumDebe),
    acumHaber: round2(acumHaber),
    saldoFinal: round2(saldoInicial + acumDebe - acumHaber),
  }
}

export function buildPunteoBalances(
  movements: PunteoLineView[],
  opening: { contable: number; punteado: number },
  window: PunteoWindow,
): { contable: PunteoBalanceRow; punteado: PunteoBalanceRow } {
  let contableOpen = opening.contable
  let punteadoOpen = opening.punteado
  let contableDebe = 0
  let contableHaber = 0
  let punteadoDebe = 0
  let punteadoHaber = 0

  const dated: PunteoWindow = { ...window, fromAmount: 0, toAmount: 0 }

  for (const line of movements) {
    if (window.fromDate && line.fecha < window.fromDate) {
      contableOpen = round2(contableOpen + line.debe - line.haber)
      if (line.punteado) punteadoOpen = round2(punteadoOpen + line.debe - line.haber)
      continue
    }
    if (!lineInPunteoWindow(line, dated)) continue
    contableDebe = round2(contableDebe + line.debe)
    contableHaber = round2(contableHaber + line.haber)
    if (line.punteado) {
      punteadoDebe = round2(punteadoDebe + line.debe)
      punteadoHaber = round2(punteadoHaber + line.haber)
    }
  }

  return {
    contable: balanceRow(contableOpen, contableDebe, contableHaber),
    punteado: balanceRow(punteadoOpen, punteadoDebe, punteadoHaber),
  }
}

export function punteoLineKey(line: {
  cuenta: string
  concepto: string
  debe: number
  haber: number
}): string {
  return [
    normalizeCuenta(line.cuenta),
    line.concepto.trim(),
    round2(line.debe).toFixed(2),
    round2(line.haber).toFixed(2),
  ].join("|")
}

export function indexPunteoStamps(
  lines: Array<{
    cuenta: string
    concepto: string
    debe: number
    haber: number
    punteado: boolean
    punteadoAt: Date | null
  }>,
): Map<string, StoredPunteo[]> {
  const pool = new Map<string, StoredPunteo[]>()
  for (const line of lines) {
    if (!line.punteado) continue
    const key = punteoLineKey(line)
    const queue = pool.get(key) ?? []
    queue.push({ punteado: true, punteadoAt: line.punteadoAt })
    pool.set(key, queue)
  }
  return pool
}

export function takePunteoStamp(
  pool: Map<string, StoredPunteo[]>,
  line: { cuenta: string; concepto: string; debe: number; haber: number },
): StoredPunteo | null {
  const queue = pool.get(punteoLineKey(line))
  if (!queue?.length) return null
  return queue.shift() ?? null
}
