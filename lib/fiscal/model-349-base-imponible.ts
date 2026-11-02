import { decimalToNumber } from "@/lib/prisma/decimal"
import { parseInvoiceDetails } from "@/lib/accounting/entry-payload"
import { collectEntryLines, isIntracomunitariaLine } from "@/lib/fiscal/fiscal-line-detection"
import { extractPrimaryEuVatId, formatEuVatIdForAeat } from "@/lib/fiscal/eu-vat-id"
import { detectModel349Clave, type Model349Clave } from "@/lib/fiscal/model-349-claves"
import { parseDeclaredBase, parseModel349Period, parseRectifiedYear } from "@/lib/fiscal/model-349/period"
import type { RawEntryLine } from "@/lib/fiscal/panorama"
import type { FiscalModelBreakdownLine } from "@/lib/types/fiscal-panorama"
import type { InvoiceEntryDetails } from "@/lib/types/invoice-entry-details"

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
  const ownDigits = normalizeCuenta(ivaLine.cuenta)
  const ownIsBase =
    ownDigits.startsWith("60") ||
    ownDigits.startsWith("61") ||
    ownDigits.startsWith("62") ||
    ownDigits.startsWith("70") ||
    ownDigits.startsWith("71")
  if (ownIsBase && !isPurchaseSideIvaLine(ivaLine) && !isSalesSideIvaLine(ivaLine)) {
    const amount = ownDigits.startsWith("7") ? netHaber(ivaLine) : netDebe(ivaLine)
    if (amount > 0) {
      return { amount, baseLineId: ivaLine.id, ivaLineId: ivaLine.id }
    }
  }

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

function invoice349Identity(line: RawEntryLine): { nif?: string; nombre?: string; hint?: string } {
  const details = parseInvoiceDetails(line.entry.invoiceDataJson)
  if (!details) return {}
  const vatLine = details.vatLines.find(
    (item) => item.taxForm === "349" || item.operation === "3" || item.operation === "7",
  )
  const nif = extractPrimaryEuVatId(details.nif)
  const hint =
    vatLine?.operation === "7"
      ? "servicios intracomunitarios"
      : vatLine?.operation === "3"
        ? "adquisicion intracomunitaria"
        : undefined
  return {
    nif: nif ? formatEuVatIdForAeat(nif) : undefined,
    nombre: details.thirdPartyName?.trim() || undefined,
    hint,
  }
}

export interface Model349FilingContext {
  year: number
  /** 1T-4T o 01-12 del periodo que se está presentando. */
  period: string
}

interface Model349Contribution {
  lineId: string
  entryId: string
  fecha: Date
  amount: number
  ivaLineId: string
  usesIvaLineAsBase: boolean
  vatId: string | null
  clave: Model349Clave
  isRectificativa: boolean
  rectifiedYear: number | null
  rectifiedPeriod: string | null
  declaredBase: number | null
  substituteVat: string | null
  substituteName: string | null
}

function invoiceDetails(line: RawEntryLine): InvoiceEntryDetails | null {
  return parseInvoiceDetails(line.entry.invoiceDataJson)
}

function movementAmount(line: RawEntryLine): number {
  return round2(Math.max(decimalToNumber(line.debe), decimalToNumber(line.haber)))
}

function entryInModel349Period(fecha: Date, year: number, period: string): boolean {
  if (fecha.getUTCFullYear() !== year) return false
  if (period.endsWith("T")) {
    const quarter = Number(period[0])
    return Math.floor(fecha.getUTCMonth() / 3) + 1 === quarter
  }
  return fecha.getUTCMonth() + 1 === Number(period)
}

function filingPeriodStart(year: number, period: string): Date {
  if (period.endsWith("T")) {
    return new Date(Date.UTC(year, (Number(period[0]) - 1) * 3, 1))
  }
  return new Date(Date.UTC(year, Number(period) - 1, 1))
}

function substituteFromDetails(details: InvoiceEntryDetails | null): { vat: string | null; name: string | null } {
  if (!details) return { vat: null, name: null }
  const extracted = extractPrimaryEuVatId(details.substituteEuVat ?? "")
  return {
    vat: extracted ? formatEuVatIdForAeat(extracted) : null,
    name: details.substituteName?.trim() || null,
  }
}

function mapRawLine(
  line: RawEntryLine,
  signedAmount: number,
  category: string,
  model349SourceLineId?: string,
  model349?: FiscalModelBreakdownLine["model349"],
): FiscalModelBreakdownLine {
  const identity = invoice349Identity(line)
  const entryConcept = [line.entry.concepto, identity.hint].filter(Boolean).join(" ") || undefined
  return {
    entryId: line.entry.id,
    entryDate: line.entry.fecha.toISOString().split("T")[0],
    entryConcept,
    lineId: line.id,
    cuenta: line.cuenta,
    concepto: line.concepto,
    debe: decimalToNumber(line.debe),
    haber: decimalToNumber(line.haber),
    signedAmount,
    category,
    nif: identity.nif,
    nombre: identity.nombre,
    model349SourceLineId,
    model349,
  }
}

function invoiceDeclares349(line: RawEntryLine): boolean {
  const details = parseInvoiceDetails(line.entry.invoiceDataJson)
  return Boolean(
    details?.vatLines.some((item) => item.taxForm === "349" || item.operation === "3" || item.operation === "7"),
  )
}

/** Líneas de facturas con impreso 349 que el concepto del asiento todavía no marca. */
export function collectModel349SourceLines(periodLines: RawEntryLine[]): RawEntryLine[] {
  const matched = periodLines.filter(isIntracomunitariaLine)
  const covered = new Set(matched.map((line) => line.entry.id))
  const byEntry = new Map<string, RawEntryLine[]>()
  for (const line of periodLines) {
    if (covered.has(line.entry.id)) continue
    const bucket = byEntry.get(line.entry.id) ?? []
    bucket.push(line)
    byEntry.set(line.entry.id, bucket)
  }

  const extra: RawEntryLine[] = []
  for (const entryLines of byEntry.values()) {
    if (!invoiceDeclares349(entryLines[0])) continue
    const iva = entryLines.find(
      (line) =>
        /^IVA\s+[SR]\./i.test(line.concepto.trim()) ||
        normalizeCuenta(line.cuenta).startsWith("472") ||
        normalizeCuenta(line.cuenta).startsWith("477"),
    )
    const base = entryLines.find((line) => /^[67]/.test(normalizeCuenta(line.cuenta)))
    const chosen = iva ?? base
    if (chosen) extra.push(chosen)
  }

  return [...matched, ...extra]
}

function oneSourcePerEntry(sourceLines: RawEntryLine[]): RawEntryLine[] {
  const byEntry = new Map<string, RawEntryLine[]>()
  for (const line of sourceLines) {
    const bucket = byEntry.get(line.entry.id) ?? []
    bucket.push(line)
    byEntry.set(line.entry.id, bucket)
  }
  return [...byEntry.values()].map((sources) => {
    return (
      sources.find(
        (line) =>
          /^IVA\s+[SR]\./i.test(line.concepto.trim()) ||
          normalizeCuenta(line.cuenta).startsWith("472") ||
          normalizeCuenta(line.cuenta).startsWith("477"),
      ) ?? sources[0]
    )
  })
}

function listModel349Contributions(
  sourceLines: RawEntryLine[],
  allLines: RawEntryLine[],
): Model349Contribution[] {
  const grouped = new Map<string, Model349Contribution>()

  for (const ivaLine of oneSourcePerEntry(sourceLines)) {
    const entryLines = collectEntryLines(allLines, ivaLine.entry.id)
    const base = resolveModel349BaseImponible(ivaLine, entryLines)
    const details = invoiceDetails(ivaLine)
    const targetLine = entryLines.find((line) => line.id === (base?.baseLineId ?? ivaLine.id)) ?? ivaLine
    let magnitude = base?.amount ?? movementAmount(ivaLine)
    if (details?.isRectificativa && magnitude === 0) magnitude = movementAmount(targetLine)
    const amount = details?.isRectificativa ? -Math.abs(magnitude) : magnitude
    if (amount === 0) continue

    const identity = invoice349Identity(ivaLine)
    const text = [ivaLine.entry.concepto, ivaLine.concepto, ...entryLines.map((line) => line.concepto)]
      .filter(Boolean)
      .join(" ")
    const vatId = identity.nif ?? (extractPrimaryEuVatId(text) ? formatEuVatIdForAeat(extractPrimaryEuVatId(text)!) : null)
    const clave = detectModel349Clave({
      concepto: ivaLine.concepto,
      entryConcept: ivaLine.entry.concepto,
      cuenta: ivaLine.cuenta,
      debe: decimalToNumber(ivaLine.debe),
      haber: decimalToNumber(ivaLine.haber),
    })
    const substitute = substituteFromDetails(details)
    const targetLineId = base?.baseLineId ?? ivaLine.id
    const existing = grouped.get(targetLineId)
    const next: Model349Contribution = {
      lineId: targetLineId,
      entryId: ivaLine.entry.id,
      fecha: ivaLine.entry.fecha,
      amount: round2((existing?.amount ?? 0) + amount),
      ivaLineId: base?.ivaLineId ?? ivaLine.id,
      usesIvaLineAsBase: targetLineId === ivaLine.id,
      vatId,
      clave,
      isRectificativa: Boolean(details?.isRectificativa),
      rectifiedYear: parseRectifiedYear(details?.rectifiedYear),
      rectifiedPeriod: parseModel349Period(details?.rectifiedPeriod),
      declaredBase: parseDeclaredBase(details?.rectifiedDeclaredBase),
      substituteVat: substitute.vat,
      substituteName: substitute.name,
    }
    grouped.set(targetLineId, next)
  }

  return [...grouped.values()]
}

function lastDeclaredBase(
  history: RawEntryLine[],
  targetYear: number,
  targetPeriod: string,
  vatId: string,
  clave: Model349Clave,
  filingStart: Date,
  userBase: number | null,
): { base: number; known: boolean } {
  if (userBase != null) return { base: userBase, known: true }

  const contributions = listModel349Contributions(collectModel349SourceLines(history), history).filter(
    (item) => item.vatId === vatId && item.clave === clave,
  )
  const inTarget = contributions.filter(
    (item) =>
      entryInModel349Period(item.fecha, targetYear, targetPeriod) &&
      (!item.isRectificativa || (item.rectifiedYear === targetYear && item.rectifiedPeriod === targetPeriod)),
  )
  const earlier = contributions.filter(
    (item) =>
      item.isRectificativa &&
      item.rectifiedYear === targetYear &&
      item.rectifiedPeriod === targetPeriod &&
      item.fecha < filingStart &&
      !entryInModel349Period(item.fecha, targetYear, targetPeriod),
  )
  if (inTarget.length === 0 && earlier.length === 0) return { base: 0, known: false }
  return {
    base: round2([...inTarget, ...earlier].reduce((sum, item) => sum + item.amount, 0)),
    known: true,
  }
}

export function rectifiedYearsOutside(lines: RawEntryLine[], currentYear: number): number[] {
  const years = new Set<number>()
  for (const line of lines) {
    const details = invoiceDetails(line)
    const year = parseRectifiedYear(details?.rectifiedYear)
    if (details?.isRectificativa && year && year !== currentYear) years.add(year)
  }
  return [...years]
}

export function buildModel349BreakdownLines(
  allLines: RawEntryLine[],
  matchedLines: RawEntryLine[],
  filing?: Model349FilingContext,
): FiscalModelBreakdownLine[] {
  const matchedIds = new Set(matchedLines.map((line) => line.id))
  const entryIds = [...new Set(matchedLines.map((line) => line.entry.id))].sort()
  const contributions = listModel349Contributions(matchedLines, allLines)
  const filingStart = filing ? filingPeriodStart(filing.year, filing.period) : null

  return entryIds.flatMap((entryId) => {
    const entryLines = collectEntryLines(allLines, entryId)
    return entryLines.map((line) => {
      const contribution = contributions.find((item) => item.lineId === line.id)
      if (!contribution) return mapRawLine(line, 0, matchedIds.has(line.id) ? "asiento" : "asiento")

      const substitute = {
        substituteVat: contribution.substituteVat ?? undefined,
        substituteName: contribution.substituteName ?? undefined,
      }
      const samePeriod =
        filing != null &&
        contribution.isRectificativa &&
        contribution.rectifiedYear === filing.year &&
        contribution.rectifiedPeriod === filing.period

      if (contribution.isRectificativa && !samePeriod) {
        if (!contribution.rectifiedYear || !contribution.rectifiedPeriod) {
          return mapRawLine(line, contribution.amount, "contributing", contribution.usesIvaLineAsBase ? undefined : contribution.ivaLineId, {
            rectificationMissing: true,
            ...substitute,
          })
        }
        const declared =
          contribution.vatId && filingStart
            ? lastDeclaredBase(
                allLines,
                contribution.rectifiedYear,
                contribution.rectifiedPeriod,
                contribution.vatId,
                contribution.clave,
                filingStart,
                contribution.declaredBase,
              )
            : { base: contribution.declaredBase ?? 0, known: contribution.declaredBase != null }
        return mapRawLine(line, contribution.amount, "contributing", contribution.usesIvaLineAsBase ? undefined : contribution.ivaLineId, {
          rectification: {
            year: contribution.rectifiedYear,
            period: contribution.rectifiedPeriod,
            previousBase: declared.base,
            previousBaseKnown: declared.known,
          },
          ...substitute,
        })
      }

      return mapRawLine(
        line,
        contribution.amount,
        "contributing",
        contribution.usesIvaLineAsBase ? undefined : contribution.ivaLineId,
        contribution.substituteVat || contribution.substituteName ? substitute : undefined,
      )
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
