import { extractPrimaryEuVatId } from "@/lib/fiscal/eu-vat-id"
import { extractPartyDisplayName } from "@/lib/fiscal/party-identification"
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

const RENTAL_EXPENSE_PREFIXES = ["621"]
const PROFESSIONAL_EXPENSE_PREFIXES = ["623", "640", "641", "642", "649"]
const RENTAL_CONCEPT_PATTERN = /ALQUILER|ARREND|RENTA\s+LOCAL|INMUEBLE|URBAN|LOCAL\s+COMERCIAL/i
const RETENTION_CONCEPT_PATTERN = /Reten[\.\/]|Retenc|RETENCI/i
const GENERIC_PARTY_KEY_PATTERN = /^(ALQUILER|ARRENDAMIENTOS?|FACTURA|SUFRA|NUESTRAFRA|IVA[SR]?|RETEN|HONORARIOS|LOCAL)/i
const MIN_PARTY_KEY_LENGTH = 8
const MIN_DOCUMENT_KEY_LENGTH = 6

export interface RentalRetentionContext {
  partyKeys: Set<string>
  documentKeys: Set<string>
}

export function groupLinesByEntry(lines: RawEntryLine[]): Map<string, RawEntryLine[]> {
  const grouped = new Map<string, RawEntryLine[]>()
  for (const line of lines) {
    const bucket = grouped.get(line.entry.id)
    if (bucket) {
      bucket.push(line)
    } else {
      grouped.set(line.entry.id, [line])
    }
  }
  return grouped
}

/** A3/PGC: 475101 y 4731 = 111; 475102 y 4732 = 115; 475100000000 genérica = sin clave. */
export function retentionModelFromAccount(cuenta: string): "111" | "115" | "123" | null {
  const padded = normalizeCuenta(cuenta).padEnd(12, "0")
  if (padded.startsWith("475102") || padded.startsWith("4732")) return "115"
  if (padded.startsWith("475103") || padded.startsWith("4733")) return "123"
  if (padded.startsWith("475101") || padded.startsWith("4731")) return "111"
  return null
}

function entryHasAccountPrefix(entryLines: RawEntryLine[] | undefined, prefixes: string[]): boolean {
  if (!entryLines || entryLines.length === 0) return false
  return entryLines.some((line) => {
    const digits = normalizeCuenta(line.cuenta)
    return prefixes.some((prefix) => digits.startsWith(prefix))
  })
}

function entryText(line: RawEntryLine, entryLines?: RawEntryLine[]): string {
  const parts = [line.concepto, line.entry.concepto ?? ""]
  if (entryLines) {
    for (const sibling of entryLines) {
      parts.push(sibling.concepto)
    }
  }
  return parts.join(" ")
}

function isRetentionConceptLine(line: RawEntryLine, entryLines?: RawEntryLine[]): boolean {
  const cuenta = normalizeCuenta(line.cuenta)
  if (cuenta.startsWith("4751") || cuenta.startsWith("473")) {
    return (
      RETENTION_CONCEPT_PATTERN.test(entryText(line, entryLines)) ||
      Boolean(retentionModelFromAccount(line.cuenta))
    )
  }
  return RETENTION_CONCEPT_PATTERN.test(line.concepto)
}

function normalizePartyKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
}

function stripTrailingDocumentToken(name: string): string {
  return name.replace(/\s+\d[\d./]*[A-Za-z]?\s*$/g, "").trim()
}

function partyKeyFromConcept(concepto: string): string | null {
  const name = stripTrailingDocumentToken(extractPartyDisplayName(concepto))
  const key = normalizePartyKey(name)
  if (key.length < MIN_PARTY_KEY_LENGTH) return null
  if (GENERIC_PARTY_KEY_PATTERN.test(key)) return null
  return key
}

function documentKeysFromText(text: string): string[] {
  const keys: string[] = []
  for (const match of text.matchAll(new RegExp(`\\d{${MIN_DOCUMENT_KEY_LENGTH},}`, "g"))) {
    keys.push(match[0])
  }
  return keys
}

function isRentalExpenseLine(line: RawEntryLine): boolean {
  const digits = normalizeCuenta(line.cuenta)
  if (digits.startsWith("621")) return true
  const text = `${line.concepto} ${line.entry.concepto ?? ""}`
  return digits.startsWith("6") && RENTAL_CONCEPT_PATTERN.test(text)
}

export function buildRentalRetentionContext(lines: RawEntryLine[]): RentalRetentionContext {
  const partyKeys = new Set<string>()
  const documentKeys = new Set<string>()
  const grouped = groupLinesByEntry(lines)

  for (const entryLines of grouped.values()) {
    if (!entryLines.some(isRentalExpenseLine)) continue
    for (const line of entryLines) {
      const text = `${line.concepto} ${line.entry.concepto ?? ""}`
      const party = partyKeyFromConcept(line.concepto) ?? partyKeyFromConcept(text)
      if (party) partyKeys.add(party)
      for (const document of documentKeysFromText(text)) documentKeys.add(document)
    }
  }

  return { partyKeys, documentKeys }
}

function partyKeysOverlap(left: string, right: string): boolean {
  if (left.length < MIN_PARTY_KEY_LENGTH || right.length < MIN_PARTY_KEY_LENGTH) return false
  return left === right || left.includes(right) || right.includes(left)
}

function matchesRentalContext(line: RawEntryLine, rental?: RentalRetentionContext): boolean {
  if (!rental) return false
  const text = `${line.concepto} ${line.entry.concepto ?? ""}`
  for (const document of documentKeysFromText(text)) {
    if (rental.documentKeys.has(document)) return true
  }
  const party = partyKeyFromConcept(line.concepto)
  if (!party) return false
  for (const rentalParty of rental.partyKeys) {
    if (partyKeysOverlap(party, rentalParty)) return true
  }
  return false
}

export function isModel123DividendRetentionLine(line: RawEntryLine): boolean {
  const haber = decimalToNumber(line.haber)
  if (haber <= 0) return false
  const concept = line.concepto
  if (/RETENCI[ÓO]N\s+DIVID/i.test(concept)) return true
  if (/RET\.?\s*DIVID/i.test(concept)) return true
  if (/DIVIDENDOS/i.test(concept) && /RETENCI|RET\.|Reten/i.test(concept)) return true
  return false
}

export function isModel115RentalRetentionLine(
  line: RawEntryLine,
  entryLines?: RawEntryLine[],
  rentalContext?: RentalRetentionContext,
): boolean {
  const haber = decimalToNumber(line.haber)
  if (haber <= 0) return false
  if (isModel123DividendRetentionLine(line)) return false

  const fromAccount = retentionModelFromAccount(line.cuenta)
  if (fromAccount === "115") return true
  if (fromAccount === "111" || fromAccount === "123") return false

  if (entryHasAccountPrefix(entryLines, RENTAL_EXPENSE_PREFIXES) && isRetentionConceptLine(line, entryLines)) {
    return true
  }

  const ownConcept = `${line.concepto} ${line.entry.concepto ?? ""}`
  if (!RETENTION_CONCEPT_PATTERN.test(ownConcept)) return false
  if (RENTAL_CONCEPT_PATTERN.test(entryText(line, entryLines))) return true
  return matchesRentalContext(line, rentalContext)
}

export function isModel111RetentionLine(
  line: RawEntryLine,
  entryLines?: RawEntryLine[],
  rentalContext?: RentalRetentionContext,
): boolean {
  const haber = decimalToNumber(line.haber)
  if (haber <= 0) return false
  if (isModel123DividendRetentionLine(line)) return false
  if (isModel115RentalRetentionLine(line, entryLines, rentalContext)) return false

  const fromAccount = retentionModelFromAccount(line.cuenta)
  if (fromAccount === "111") return true
  if (fromAccount === "115" || fromAccount === "123") return false
  if (entryHasAccountPrefix(entryLines, RENTAL_EXPENSE_PREFIXES)) return false
  if (entryHasAccountPrefix(entryLines, PROFESSIONAL_EXPENSE_PREFIXES)) {
    return isRetentionConceptLine(line, entryLines)
  }
  return /Reten[\.\/]/i.test(line.concepto) || /Retenc/i.test(line.concepto)
}

export function collectEntryLines(lines: RawEntryLine[], entryId: string): RawEntryLine[] {
  return lines.filter((line) => line.entry.id === entryId)
}

export interface LiquidationDetail {
  amount: number
  entryId: string
  contributingLineId: string
}

function pickLiquidationCandidate(candidates: Array<{ entryId: string; signedAmount: number; line: RawEntryLine; amount: number }>, pattern: RegExp): LiquidationDetail | null {
  if (candidates.length === 0) return null

  const pickFrom = (pool: typeof candidates) =>
    pool.reduce((best, cur) => (cur.amount < best.amount ? cur : best))

  const picked =
    candidates.length === 1
      ? candidates[0]
      : (() => {
          const modeloCandidates = candidates.filter((candidate) => pattern.test(candidate.line.concepto))
          return modeloCandidates.length > 0 ? pickFrom(modeloCandidates) : pickFrom(candidates)
        })()

  return {
    amount: round2(picked.signedAmount),
    entryId: picked.entryId,
    contributingLineId: picked.line.id,
  }
}

function extractLiquidationDetail(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
  modelCode: string,
): LiquidationDetail | null {
  const compensationPattern = /Cuotas compensar/i
  const pattern =
    quarter === "annual"
      ? new RegExp(`Modelo\\s+${modelCode}(?!\\s+\\d)`, "i")
      : new RegExp(`Modelo\\s+${modelCode}\\s+${quarter}\\s+Trimestre`, "i")

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

  return pickLiquidationCandidate(candidates, pattern)
}

export function extractModel111LiquidationAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): number | null {
  return extractLiquidationDetail(lines, year, quarter, "111")?.amount ?? null
}

export function extractModel111LiquidationDetail(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): LiquidationDetail | null {
  return extractLiquidationDetail(lines, year, quarter, "111")
}

export function extractGenericModelLiquidationDetail(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
  modelCode: string,
): LiquidationDetail | null {
  return extractLiquidationDetail(lines, year, quarter, modelCode)
}

export interface NrcPaymentDetail {
  amount: number
  entryId: string
  contributingLineId: string
}

export function extractModel111NrcPaymentDetail(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): NrcPaymentDetail | null {
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

  return {
    amount: round2(Math.abs(pick.signedAmount)),
    entryId: pick.line.entry.id,
    contributingLineId: pick.line.id,
  }
}

export function extractModel111NrcPaymentAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): number | null {
  return extractModel111NrcPaymentDetail(lines, year, quarter)?.amount ?? null
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

export function extractModel303LiquidationAmount(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): number | null {
  return extractLiquidationDetail(lines, year, quarter, "303")?.amount ?? null
}

export function extractModel303LiquidationDetail(
  lines: RawEntryLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): LiquidationDetail | null {
  return extractLiquidationDetail(lines, year, quarter, "303")
}

export function isIntracomunitariaLine(line: RawEntryLine): boolean {
  const concept = `${line.concepto} ${line.entry.concepto ?? ""}`
  if (/INTRACOMUNIT|INTRA\s*COM|ADQ\.?\s*INTRA|IVA\s+[AR]\.\/.*INTRA/i.test(concept)) {
    return true
  }
  if (/INTRA/i.test(line.concepto) && /IVA/i.test(line.concepto)) {
    return true
  }

  const trimmedConcept = line.concepto.trim()
  if (/^IVA\s+[SR]\./i.test(trimmedConcept)) {
    if (extractPrimaryEuVatId(concept)) {
      return true
    }
    if (
      /GOOGLE\s+IRELAND|AMAZON\s+(EU|SERVICES)|META\s+PLATFORMS|MICROSOFT\s+IRELAND|STRIPE\s+PAYMENTS/i.test(
        concept,
      )
    ) {
      return true
    }
  }

  return false
}

export function liquidationSignedAmount(line: RawEntryLine, contributingLineId: string): number {
  if (line.id !== contributingLineId) return 0
  const haber = decimalToNumber(line.haber)
  const debe = decimalToNumber(line.debe)
  return haber > 0 ? round2(haber) : -round2(debe)
}
