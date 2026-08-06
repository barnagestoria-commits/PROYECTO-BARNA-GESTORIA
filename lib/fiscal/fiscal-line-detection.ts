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

export function isModel111RetentionLine(line: RawEntryLine): boolean {
  const haber = decimalToNumber(line.haber)
  if (haber <= 0) return false
  return /Reten\.\//i.test(line.concepto)
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
  const pattern = new RegExp(`Modelo\\s+303\\s+${quarter}\\s+Trimestre`, "i")
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

  type Candidate = { entryId: string; signedAmount: number; line: RawEntryLine }
  const candidates: Candidate[] = []

  for (const line of lines) {
    if (!isDateInYear(line.entry.fecha, year)) continue
    if (entryHasSupplierAccount(line.entry.id)) continue
    if (compensationPattern.test(line.concepto)) continue

    const text = `${line.concepto} ${line.entry.concepto ?? ""}`
    if (!pattern.test(text)) continue

    const debe = decimalToNumber(line.debe)
    const haber = decimalToNumber(line.haber)
    const amount = Math.max(debe, haber)
    if (amount <= 0 || amount >= LIQUIDATION_CLEARING_THRESHOLD) continue

    const cuenta = normalizeCuenta(line.cuenta)
    if (
      !cuenta.startsWith("572") &&
      !cuenta.startsWith("555") &&
      !cuenta.startsWith("470")
    ) {
      continue
    }

    candidates.push({
      entryId: line.entry.id,
      signedAmount: haber > 0 ? haber : -debe,
      line,
    })
  }

  if (candidates.length === 0) return null

  const byEntry = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const bucket = byEntry.get(candidate.entryId) ?? []
    bucket.push(candidate)
    byEntry.set(candidate.entryId, bucket)
  }

  const singleLineEntries = [...byEntry.entries()].filter(([, entryCandidates]) => entryCandidates.length === 1)
  if (singleLineEntries.length === 1) {
    return round2(singleLineEntries[0][1][0].signedAmount)
  }

  if (singleLineEntries.length > 1) {
    const directMatches = singleLineEntries
      .map(([, entryCandidates]) => entryCandidates[0])
      .filter((candidate) => pattern.test(candidate.line.concepto))
    if (directMatches.length === 1) {
      return round2(directMatches[0].signedAmount)
    }

    const haberCandidates = singleLineEntries
      .map(([, entryCandidates]) => entryCandidates[0])
      .filter((candidate) => candidate.signedAmount > 0)
    if (haberCandidates.length === 1) {
      return round2(haberCandidates[0].signedAmount)
    }

    const debeCandidates = singleLineEntries
      .map(([, entryCandidates]) => entryCandidates[0])
      .filter((candidate) => candidate.signedAmount < 0)
    if (debeCandidates.length === 1) {
      return round2(debeCandidates[0].signedAmount)
    }
  }

  const amounts = candidates.map((candidate) => candidate.signedAmount)
  const haberAmounts = amounts.filter((value) => value > 0)
  if (haberAmounts.length === 1) {
    return round2(haberAmounts[0])
  }
  if (haberAmounts.length > 1) {
    return round2(Math.max(...haberAmounts))
  }

  return round2(Math.min(...amounts))
}
