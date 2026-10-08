import { round2 } from "@/lib/reports/format"

export interface ParsedEntrySearch {
  raw: string
  text: string
  amount: number | null
  refNumber: number | null
  date: string | null
  accountDigits: string | null
}

export interface SearchableEntryLine {
  cuenta: string
  concepto: string
  debe: number
  haber: number
}

export interface SearchableEntry {
  refNumber: number
  fecha: string
  commandCode: string | null
  invoiceNumber: string | null
  invoiceDataJson: string | null
  lines: SearchableEntryLine[]
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "")
}

function parseSearchDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value)
  if (!local) return null
  const day = local[1].padStart(2, "0")
  const month = local[2].padStart(2, "0")
  return `${local[3]}-${month}-${day}`
}

/** Importe en formato 1520,82, 1.520,82 o 1520.82. Un código 430.0001 no es un importe. */
export function parseSearchAmount(value: string): number | null {
  const cleaned = value.replace(/€/g, "").replace(/\s/g, "").trim()
  if (!cleaned || cleaned.endsWith("+")) return null

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".")
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
    const amount = Number(normalized)
    return Number.isFinite(amount) ? round2(amount) : null
  }

  if (/^\d+\.\d{2}$/.test(cleaned)) {
    return round2(Number(cleaned))
  }

  if (/^\d+$/.test(cleaned)) {
    return round2(Number(cleaned))
  }

  return null
}

function parseSearchAccount(value: string): string | null {
  const trimmed = value.trim()
  if (/^\d{2,4}(?:\.\d{1,8})+$/.test(trimmed)) {
    const digits = digitsOf(trimmed)
    return digits.length >= 2 ? digits : null
  }
  if (/^\d{3,}$/.test(trimmed)) return trimmed
  return null
}

export function parseEntrySearchQuery(raw: string): ParsedEntrySearch | null {
  const text = raw.trim()
  if (!text) return null

  const date = parseSearchDate(text)
  const accountDigits = date ? null : parseSearchAccount(text)
  const amount = date || (accountDigits && text.includes(".")) ? null : parseSearchAmount(text)
  const refNumber = /^\d{1,6}$/.test(text) ? Number.parseInt(text, 10) : null

  return {
    raw: text,
    text,
    amount,
    refNumber,
    date,
    accountDigits,
  }
}

function includesText(haystack: string, query: string): boolean {
  return haystack.toLocaleLowerCase("es-ES").includes(query.toLocaleLowerCase("es-ES"))
}

/** Un asiento coincide si el texto, el importe, la ref., la fecha o la cuenta encajan. */
export function entryMatchesSearch(entry: SearchableEntry, criteria: ParsedEntrySearch): boolean {
  const conceptos = entry.lines.map((line) => line.concepto)
  const cuentas = entry.lines.map((line) => line.cuenta)
  const haystack = [
    String(entry.refNumber),
    entry.fecha,
    entry.commandCode ?? "",
    entry.invoiceNumber ?? "",
    entry.invoiceDataJson ?? "",
    ...conceptos,
    ...cuentas,
  ].join(" ")

  if (includesText(haystack, criteria.text)) return true
  if (criteria.refNumber != null && entry.refNumber === criteria.refNumber) return true
  if (criteria.date && entry.fecha === criteria.date) return true

  if (criteria.accountDigits) {
    const hit = entry.lines.some((line) => digitsOf(line.cuenta).includes(criteria.accountDigits!))
    if (hit) return true
  }

  if (criteria.amount != null) {
    const amount = criteria.amount
    const lineHit = entry.lines.some(
      (line) => round2(line.debe) === amount || round2(line.haber) === amount,
    )
    if (lineHit) return true
    const total = round2(entry.lines.reduce((sum, line) => sum + line.debe, 0))
    if (total === amount) return true
  }

  return false
}
