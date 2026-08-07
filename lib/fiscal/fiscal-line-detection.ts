import { decimalToNumber } from "@/lib/prisma/decimal"
import type { RawEntryLine } from "@/lib/fiscal/panorama"

const LIQUIDATION_CLEARING_THRESHOLD = 200_000

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeCuenta(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function isDateInYear(date: Date, year: number): boolean {
  return date.getUTCFullYear() === year
}

function isDateInQuarter(date: Date, year: number, quarter: 1 | 2 | 3 | 4): boolean {
  if (date.getUTCFullYear() !== year) return false
  const month = date.getUTCMonth() + 1
  const quarterFromMonth = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
  return quarterFromMonth === quarter
}

function nrcPaymentMonthForQuarter(quarter: 1 | 2 | 3 | 4): { month: number; yearOffset: number } {
  return (
    { 1: { month: 4, yearOffset: 0 }, 2: { month: 7, yearOffset: 0 }, 3: { month: 10, yearOffset: 0 }, 4: { month: 1, yearOffset: 1 } }[
      quarter
    ] ?? { month: 1, yearOffset: 0 }
  )
}

function isModel111NrcConcept(text: string): boolean {
  if (/123/i.test(text)) return false
  return /NRC\.?\s*111/i.test(text) || /NRC\.?\s*11\b/i.test(text)
}

export function isModel111RetentionLine(line: RawEntryLine): boolean {
  const haber = decimalToNumber(line.haber)
  if (haber <= 0) return false
  if (/RETENCI[ÓO]N\s+DIVID/i.test(line.concepto)) return false
  return /Reten[\.\/]/i.test(line.concepto) || /Retenc/i.test(line.concepto)
}

function extractLiquidationAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
  modelCode: "111" | "303",
): number | null {
  const pattern = new RegExp(`Modelo\\s+${modelCode}\\s+${quarter}\\s+Trimestre`, "i")
  const compensationPattern = /Cuotas compensar/i

  const linesByEntry = new Map<string, RawEntryLine[]>()
  for (const line of lines) {
    if (!isDateInYear(line.entry.fecha, year)) continue
    const bucket = linesByEntry.get(line.entry.id) ?? []
    bucket.push(line)
    linesByEntry.set(line.entry.id, bucket)
  }

  function entryHasSupplierAccount(entryId: string): boolean {
    const entryLines = linesByEntry.get(entryId) ?? []
    return entryLines.some((entryLine) => normalizeCuenta(entryLine.cuenta).startsWith("400"))
  }

  type Candidate = { entryId: string; signedAmount: number; line: RawEntryLine; amount: number }
  const candidates: Candidate[] = []

  for (const line of lines) {
    if (!isDateInYear(line.entry.fecha, year)) continue
    if (modelCode === "303" && entryHasSupplierAccount(line.entry.id)) continue
    if (compensationPattern.test(line.concepto)) continue

    const text = `${line.concepto} ${line.entry.concepto ?? ""}`
    if (!pattern.test(text)) continue

    const debe = decimalToNumber(line.debe)
    const haber = decimalToNumber(line.haber)
    const amount = Math.max(debe, haber)
    if (amount <= 0 || amount >= LIQUIDATION_CLEARING_THRESHOLD) continue

    candidates.push({
      entryId: line.entry.id,
      signedAmount: haber > 0 ? haber : -debe,
      line,
      amount,
    })
  }

  if (candidates.length === 0) return null
  if (candidates.length === 1) return round2(candidates[0].signedAmount)

  const modeloCandidates = candidates.filter((candidate) => pattern.test(candidate.line.concepto))
  if (modeloCandidates.length > 0) {
    const pick = modeloCandidates.reduce((best, cur) => (cur.amount < best.amount ? cur : best))
    return round2(pick.signedAmount)
  }

  const pick = candidates.reduce((best, cur) => (cur.amount < best.amount ? cur : best))
  return round2(pick.signedAmount)
}

export function extractModel111LiquidationAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): number | null {
  return extractLiquidationAmount(lines, year, quarter, "111")
}

export function extractModel111NrcPaymentAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): number | null {
  const { month, yearOffset } = nrcPaymentMonthForQuarter(quarter)
  const paymentYear = year + yearOffset
  const start = new Date(`${paymentYear}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`)
  const end = new Date(`${paymentYear}-${String(month).padStart(2, "0")}-${String(new Date(paymentYear, month, 0).getDate()).padStart(2, "0")}T23:59:59.999Z`)

  type Candidate = { amount: number; signedAmount: number; line: RawEntryLine }
  const candidates: Candidate[] = []

  for (const line of lines) {
    const fecha = line.entry.fecha
    if (fecha < start || fecha > end) continue

    const text = `${line.concepto} ${line.entry.concepto ?? ""}`
    if (!isModel111NrcConcept(text)) continue

    const cuenta = normalizeCuenta(line.cuenta)
    if (!cuenta.startsWith("572") && !cuenta.startsWith("555") && !cuenta.startsWith("475101")) {
      continue
    }

    const debe = decimalToNumber(line.debe)
    const haber = decimalToNumber(line.haber)
    const amount = Math.max(debe, haber)
    if (amount <= 0 || amount >= LIQUIDATION_CLEARING_THRESHOLD) continue

    candidates.push({
      amount,
      signedAmount: haber > 0 ? haber : -debe,
      line,
    })
  }

  if (candidates.length === 0) return null
  const haberCandidates = candidates.filter((candidate) => decimalToNumber(candidate.line.haber) > 0)
  const pick = (haberCandidates.length > 0 ? haberCandidates : candidates).reduce((best, cur) =>
    cur.amount < best.amount ? cur : best,
  )
  return round2(Math.abs(pick.signedAmount))
}

export function extractModel111NrcAccrualLines(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): RawEntryLine[] {
  return lines.filter((line) => {
    if (!isDateInQuarter(line.entry.fecha, year, quarter)) return false
    const text = `${line.concepto} ${line.entry.concepto ?? ""}`
    if (!isModel111NrcConcept(text)) return false
    const cuenta = normalizeCuenta(line.cuenta)
    return cuenta.startsWith("475101") && decimalToNumber(line.debe) > 0
  })
}

export function isModel123DividendRetentionLine(line: RawEntryLine): boolean {
  const haber = decimalToNumber(line.haber)
  if (haber <= 0) return false
  return /RETENCI[ÓO]N\s+DIVID/i.test(line.concepto)
}

export function extractModel303LiquidationAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): number | null {
  return extractLiquidationAmount(lines, year, quarter, "303")
}
