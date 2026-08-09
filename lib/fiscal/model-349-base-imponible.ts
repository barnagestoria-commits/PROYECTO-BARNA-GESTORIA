import { decimalToNumber } from "@/lib/prisma/decimal"
import { collectEntryLines } from "@/lib/fiscal/fiscal-line-detection"
import type { RawEntryLine } from "@/lib/fiscal/panorama"
import type { FiscalModelBreakdownLine } from "@/lib/types/fiscal-panorama"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeCuenta(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function netDebe(line: RawEntryLine): number {
  return round2(Math.max(0, decimalToNumber(line.debe) - decimalToNumber(line.haber)))
}

function netHaber(line: RawEntryLine): number {
  return round2(Math.max(0, decimalToNumber(line.haber) - decimalToNumber(line.debe)))
}

function isExcludedFromBase(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return /^(472|477|470|475|473|572|570|571)/.test(digits)
}

function isPurchaseBaseAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return digits.startsWith("60") || digits.startsWith("61") || digits.startsWith("62")
}

function isSalesBaseAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return digits.startsWith("70") || digits.startsWith("71")
}

function isPurchaseThirdPartyAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return digits.startsWith("400") || digits.startsWith("410")
}

function isSalesThirdPartyAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  return digits.startsWith("430") || digits.startsWith("431") || digits.startsWith("440")
}

function isPurchaseSideIvaLine(ivaLine: RawEntryLine): boolean {
  if (/^IVA\s+S\./i.test(ivaLine.concepto.trim())) return true
  return normalizeCuenta(ivaLine.cuenta).startsWith("472")
}

function isSalesSideIvaLine(ivaLine: RawEntryLine): boolean {
  if (/^IVA\s+R\./i.test(ivaLine.concepto.trim())) return true
  return normalizeCuenta(ivaLine.cuenta).startsWith("477")
}

export interface Model349BaseImponibleResult {
  amount: number
  baseLineId: string
  ivaLineId: string
}

interface BaseCandidate {
  line: RawEntryLine
  amount: number
  priority: number
}

function compareCandidates(
  a: BaseCandidate,
  b: BaseCandidate,
  ivaAmount: number,
): number {
  if (a.priority !== b.priority) return a.priority - b.priority
  if (ivaAmount > 0) {
    const diffA = Math.abs(a.amount * 0.21 - ivaAmount)
    const diffB = Math.abs(b.amount * 0.21 - ivaAmount)
    if (diffA !== diffB) return diffA - diffB
  }
  return b.amount - a.amount
}

export function resolveModel349BaseImponible(
  ivaLine: RawEntryLine,
  entryLines: RawEntryLine[],
): Model349BaseImponibleResult | null {
  const purchase = isPurchaseSideIvaLine(ivaLine)
  const sales = isSalesSideIvaLine(ivaLine)
  const side: "purchase" | "sales" = purchase ? "purchase" : sales ? "sales" : "purchase"

  const candidates: BaseCandidate[] = []

  for (const line of entryLines) {
    if (line.id === ivaLine.id || isExcludedFromBase(line.cuenta)) continue

    if (side === "purchase") {
      if (isPurchaseBaseAccount(line.cuenta)) {
        const amount = netDebe(line)
        if (amount > 0) candidates.push({ line, amount, priority: 1 })
      } else if (isPurchaseThirdPartyAccount(line.cuenta)) {
        const amount = netHaber(line)
        if (amount > 0) candidates.push({ line, amount, priority: 2 })
      }
    } else if (isSalesBaseAccount(line.cuenta)) {
      const amount = netHaber(line)
      if (amount > 0) candidates.push({ line, amount, priority: 1 })
    } else if (isSalesThirdPartyAccount(line.cuenta)) {
      const amount = netDebe(line)
      if (amount > 0) candidates.push({ line, amount, priority: 2 })
    }
  }

  if (candidates.length === 0) return null

  const ivaAmount = round2(
    Math.max(decimalToNumber(ivaLine.debe), decimalToNumber(ivaLine.haber)),
  )
  candidates.sort((a, b) => compareCandidates(a, b, ivaAmount))
  const best = candidates[0]

  return {
    amount: best.amount,
    baseLineId: best.line.id,
    ivaLineId: ivaLine.id,
  }
}

function mapRawLine(
  line: RawEntryLine,
  signedAmount: number,
  category: string,
  model349SourceLineId?: string,
): FiscalModelBreakdownLine {
  return {
    entryId: line.entry.id,
    entryDate: line.entry.fecha.toISOString().split("T")[0],
    entryConcept: line.entry.concepto ?? undefined,
    lineId: line.id,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: decimalToNumber(line.debe),
    haber: decimalToNumber(line.haber),
    signedAmount,
    category,
    model349SourceLineId,
  }
}

export function buildModel349BreakdownLines(
  allLines: RawEntryLine[],
  matchedLines: RawEntryLine[],
): FiscalModelBreakdownLine[] {
  const matchedIds = new Set(matchedLines.map((line) => line.id))
  const entryIds = [...new Set(matchedLines.map((line) => line.entry.id))].sort()

  const contributingByLineId = new Map<
    string,
    { amount: number; ivaLineId: string; usesIvaLineAsBase: boolean }
  >()

  for (const ivaLine of matchedLines) {
    const entryLines = collectEntryLines(allLines, ivaLine.entry.id)
    const base = resolveModel349BaseImponible(ivaLine, entryLines)
    const fallbackAmount = round2(
      Math.max(decimalToNumber(ivaLine.debe), decimalToNumber(ivaLine.haber)),
    )

    const targetLineId = base?.baseLineId ?? ivaLine.id
    const amount = base?.amount ?? fallbackAmount
    const ivaLineId = base?.ivaLineId ?? ivaLine.id
    const usesIvaLineAsBase = targetLineId === ivaLine.id

    const existing = contributingByLineId.get(targetLineId)
    if (existing) {
      contributingByLineId.set(targetLineId, {
        amount: round2(existing.amount + amount),
        ivaLineId: existing.ivaLineId,
        usesIvaLineAsBase: existing.usesIvaLineAsBase && usesIvaLineAsBase,
      })
    } else {
      contributingByLineId.set(targetLineId, { amount, ivaLineId, usesIvaLineAsBase })
    }
  }

  return entryIds.flatMap((entryId) => {
    const entryLines = collectEntryLines(allLines, entryId)
    return entryLines.map((line) => {
      const contribution = contributingByLineId.get(line.id)
      if (contribution) {
        return mapRawLine(
          line,
          contribution.amount,
          "contributing",
          contribution.usesIvaLineAsBase ? undefined : contribution.ivaLineId,
        )
      }

      if (matchedIds.has(line.id)) {
        return mapRawLine(line, 0, "asiento")
      }

      return mapRawLine(line, 0, "asiento")
    })
  })
}

export function findModel349IvaContextLine(
  line: FiscalModelBreakdownLine,
  sectionLines: FiscalModelBreakdownLine[],
): FiscalModelBreakdownLine {
  if (line.model349SourceLineId) {
    const source = sectionLines.find((item) => item.lineId === line.model349SourceLineId)
    if (source) return source
  }

  if (/^IVA\s+[SR]\./i.test(line.concepto.trim())) {
    return line
  }

  const siblingIva = sectionLines.find(
    (item) =>
      item.entryId === line.entryId && /^IVA\s+[SR]\./i.test(item.concepto.trim()),
  )
  return siblingIva ?? line
}

export function collectModel349EntryText(
  line: FiscalModelBreakdownLine,
  sectionLines: FiscalModelBreakdownLine[],
): string {
  const entryLines = sectionLines.filter((item) => item.entryId === line.entryId)
  return [
    line.entryConcept,
    ...entryLines.map((item) => item.concepto),
    findModel349IvaContextLine(line, sectionLines).concepto,
  ]
    .filter(Boolean)
    .join(" ")
}
