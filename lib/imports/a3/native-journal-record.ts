import type { ImportBytes } from "@/lib/imports/a3/import-bytes"
import { decodeA3Text } from "@/lib/imports/a3/import-bytes"
import { padAccountCode12 } from "@/lib/imports/a3/native-account-code"
import { isDeletedCobolStatus } from "@/lib/imports/a3/native-cobol-records"
import type { NativePlanRegistry } from "@/lib/imports/a3/parse-native-plan"

export const NATIVE_JOURNAL_HEADER = 512
export const NATIVE_JOURNAL_LINE = 132
export const NATIVE_JOURNAL_CONCEPT_START = 26

const GENERIC_BANK = "572000000000"
const GENERIC_RETENCION = "473000000000"
const RETENCION_PRACTICADAS = "475101000000"

export interface NativeJournalHeaderInfo {
  refNumber: number
  groupKey: string
  lookupKey: string
  fecha: string | null
  documento: string | null
  concepto: string | null
}

function cleanConcept(raw: string): string {
  return raw
    .replace(/\x00/g, " ")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/[^\x20-\x7E\u00C0-\u00FF.,\-/()&º°"]/g, " ")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function dateFromDayOfYear(year: number, dayOfYear: number): string | null {
  if (dayOfYear < 1 || dayOfYear > 366) return null
  const date = new Date(Date.UTC(year, 0, dayOfYear))
  if (date.getUTCFullYear() !== year) return null
  return date.toISOString().slice(0, 10)
}

export function nativeJournalLineRecordStart(buffer: ImportBytes): number {
  if (decodeA3Text(buffer.slice(0, 2)) === "0~") {
    return NATIVE_JOURNAL_HEADER
  }

  const searchStart = NATIVE_JOURNAL_HEADER
  const head = buffer.subarray(searchStart)
  const firstMatch = decodeA3Text(head).match(/[DH]\d{11,14}/)
  if (!firstMatch || firstMatch.index === undefined) {
    return searchStart
  }

  const absPos = searchStart + firstMatch.index
  let bestOffset = 0
  let bestScore = -1

  for (let trial = 0; trial < NATIVE_JOURNAL_LINE; trial += 1) {
    const start = absPos - trial
    if (start < NATIVE_JOURNAL_HEADER) continue

    let zeroHeader = 0
    let valid = 0
    for (let pos = start; pos + NATIVE_JOURNAL_LINE <= buffer.length; pos += NATIVE_JOURNAL_LINE) {
      const rec = buffer.subarray(pos, pos + NATIVE_JOURNAL_LINE)
      if (!/[DH]\d{11,14}/.test(decodeA3Text(rec))) continue
      valid += 1
      if (rec.subarray(0, 12).every((byte) => byte === 0)) zeroHeader += 1
    }

    const score = zeroHeader * 1000 + valid
    if (score > bestScore) {
      bestScore = score
      bestOffset = trial
    }
  }

  return absPos - bestOffset
}

export function nativeEntryGroupKey(rec: ImportBytes): string {
  return rec.subarray(14, 20).toString("hex")
}

export function nativeEntryLookupKey(rec: ImportBytes): string {
  return rec.subarray(15, 20).toString("hex")
}

export function decodeNativeAccountingDate(
  rec: ImportBytes,
  fiscalYear: number,
): string | null {
  if (rec.length < 18) return null
  const encoded = (rec[15] ?? 0) * 0x10000 + (rec[16] ?? 0) * 0x100 + (rec[17] ?? 0)
  const rawDate = encoded - 0x312d00
  if (rawDate < 0 || rawDate > 999999) return null

  const digits = String(rawDate).padStart(6, "0")
  const shortYear = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const day = Number(digits.slice(4, 6))
  const century = Math.floor(fiscalYear / 100) * 100
  let year = century + shortYear
  if (year - fiscalYear > 50) year -= 100
  if (fiscalYear - year > 50) year += 100

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return formatIsoDate(year, month, day)
}

export function nativeJournalReference(rec: ImportBytes): number | null {
  if (rec.length < 126) return null
  const value =
    (rec[122] ?? 0) * 0x1000000 +
    (rec[123] ?? 0) * 0x10000 +
    (rec[124] ?? 0) * 0x100 +
    (rec[125] ?? 0)
  return value > 0 ? value : null
}

/** Número de línea contable A3 (2=tercero, 3=IVA, 5=retención, 6=base). */
export function nativeJournalLineSequence(rec: ImportBytes): number {
  const sequence = rec[22] ?? 0
  if (sequence >= 1 && sequence <= 9) return sequence
  // Compatibilidad defensiva con exportaciones antiguas ya soportadas.
  return rec[11] ?? 0
}

export function extractNativePostAmountMarker(rec: ImportBytes): string {
  return decodeA3Text(rec.subarray(87, 94)).replace(/\x00/g, "").trim()
}

export function extractNativeConcept(text: string, dhIndex: number): string {
  const raw = text.slice(NATIVE_JOURNAL_CONCEPT_START, Math.max(NATIVE_JOURNAL_CONCEPT_START, dhIndex - 4))
  const retenMatch = raw.match(/"?\s*Reten[\.\/][^@]{4,}/i)
  if (retenMatch) {
    return cleanConcept(retenMatch[0])
  }
  const altMatch = text.slice(15, dhIndex).match(/[A-ZÁÉÍÓÚÑ][A-Z0-9 ÁÉÍÓÚÜÑ.\-/]{4,}/)
  const concept = altMatch ? altMatch[0] : raw
  return cleanConcept(concept)
}

export function extractNativeDocument(concept: string, headerDocumento?: string | null): string {
  if (headerDocumento) return headerDocumento
  const match = concept.match(/\b(F\d{8,}|A\s+\d{3,5}|\d{2}[A-Z]{2,}\d{2,})\s*$/)
  return match?.[1]?.trim() ?? ""
}

export function extractNativeDate(
  concept: string,
  rec: ImportBytes,
  fiscalYear: number,
  fileMonth: number,
  headerDate?: string | null,
): string {
  const binaryDate = decodeNativeAccountingDate(rec, fiscalYear)
  if (binaryDate) return binaryDate

  if (headerDate && /^\d{8}$/.test(headerDate)) {
    return `${headerDate.slice(0, 4)}-${headerDate.slice(4, 6)}-${headerDate.slice(6, 8)}`
  }

  const doyTag = concept.match(/20(2[4-9]|3[0-9])-(\d{3})/)
  if (doyTag) {
    const dayOfYearNum = Number(doyTag[2])
    // Evitar confundir referencias de factura (p. ej. 2026-025) con día juliano.
    if (dayOfYearNum >= 32) {
      const iso = dateFromDayOfYear(Number(`20${doyTag[1]}`), dayOfYearNum)
      if (iso) return iso
    }
  }

  const ymd = concept.match(/(20[2-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])/)
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  }

  return formatIsoDate(fiscalYear, fileMonth, 1)
}

export function resolveNativeAccountFromMarker(
  marker: string,
  dh: "D" | "H",
  concept: string,
  registry: NativePlanRegistry,
): string | null {
  const upper = concept.toUpperCase()

  if (marker.startsWith("A5S")) {
    return registry.defaultBankAccount ?? padAccountCode12(GENERIC_BANK)
  }

  if (marker === "AC" || marker.startsWith("AC")) {
    if (/MODELO\s+303/i.test(upper)) {
      return dh === "H"
        ? registry.defaultBankAccount ?? padAccountCode12(GENERIC_BANK)
        : padAccountCode12("555000000000")
    }
    if (/MODELO\s+111/i.test(upper)) {
      return dh === "H"
        ? registry.defaultBankAccount ?? padAccountCode12(GENERIC_BANK)
        : padAccountCode12(RETENCION_PRACTICADAS)
    }
    if (/MODELO\s+115/i.test(upper)) {
      return dh === "H"
        ? registry.defaultBankAccount ?? padAccountCode12(GENERIC_BANK)
        : padAccountCode12(RETENCION_PRACTICADAS)
    }
    if (/MODELO\s+130/i.test(upper)) {
      return dh === "H"
        ? registry.defaultBankAccount ?? padAccountCode12(GENERIC_BANK)
        : registry.defaultRetencionAccount ?? padAccountCode12(GENERIC_RETENCION)
    }
    if (/IMPUESTOS|TRIBUTOS|NRC/i.test(upper)) {
      return padAccountCode12(RETENCION_PRACTICADAS)
    }
    return registry.defaultRetencionAccount ?? padAccountCode12(GENERIC_RETENCION)
  }

  if (marker.startsWith("A5") && dh === "H") {
    return registry.defaultBankAccount ?? padAccountCode12(GENERIC_BANK)
  }

  return null
}

function extractHeaderDocument(text: string): string | null {
  const tagged =
    text.match(/\b(A\s+\d{3,5})\b/i)?.[1] ??
    text.match(/\b(F\d{8,})\b/i)?.[1] ??
    text.match(/\b([A-Z]\d{5,})\b/)?.[1]
  return tagged ? tagged.replace(/\s+/g, " ").trim().toUpperCase() : null
}

function extractHeaderDate(text: string): string | null {
  const ymd = text.match(/(20[2-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])/)
  return ymd ? `${ymd[1]}${ymd[2]}${ymd[3]}` : null
}

function extractHeaderConcept(text: string): string | null {
  const cleaned = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const gasto = cleaned.match(/Gasto a [^0-9]+/i)?.[0]
  if (gasto) return cleanConcept(gasto)
  const invoice = cleaned.match(/Nuestra Factura Nº[^0-9]{0,3}[A-Z0-9 ./-]+/i)?.[0]
  if (invoice) return cleanConcept(invoice)
  return null
}

function isNativeJournalHeaderStatus(statusByte: number): boolean {
  return statusByte === 0x40 || statusByte === 0x41 || statusByte === 0x42
}

export function parseNativeJournalHeaders(buffer: ImportBytes): NativeJournalHeaderInfo[] {
  const start = nativeJournalLineRecordStart(buffer)
  const headers: NativeJournalHeaderInfo[] = []
  let refNumber = 0

  for (let pos = start; pos + NATIVE_JOURNAL_LINE <= buffer.length; pos += NATIVE_JOURNAL_LINE) {
    const rec = buffer.subarray(pos, pos + NATIVE_JOURNAL_LINE)
    if (isDeletedCobolStatus(rec[0]!)) continue
    if (!isNativeJournalHeaderStatus(rec[14]!)) continue

    refNumber += 1
    const text = decodeA3Text(rec)
    headers.push({
      refNumber,
      groupKey: rec.subarray(16, 21).toString("hex"),
      lookupKey: rec.subarray(16, 21).toString("hex"),
      fecha: extractHeaderDate(text),
      documento: extractHeaderDocument(text),
      concepto: extractHeaderConcept(text),
    })
  }

  return headers
}

export function buildNativeHeaderIndex(headers: NativeJournalHeaderInfo[]): Map<string, NativeJournalHeaderInfo> {
  const map = new Map<string, NativeJournalHeaderInfo>()
  for (const header of headers) {
    if (!map.has(header.lookupKey)) {
      map.set(header.lookupKey, header)
    }
  }
  return map
}
