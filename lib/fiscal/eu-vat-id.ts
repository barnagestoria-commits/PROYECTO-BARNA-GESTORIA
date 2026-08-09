/**
 * Identificadores IVA intracomunitarios (formato VIES / AEAT modelo 349).
 */

export const EU_VAT_COUNTRY_PREFIXES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "XI",
])

/** NIF-IVA compacto: prefijo país + identificador sin espacios intermedios. */
const EU_VAT_COMPACT_PATTERN = /\b([A-Z]{2})[\s.\-/]?([A-Z0-9]{2,12})\b/gi

/** NIF-IVA con dígitos espaciados (habitual en facturas FR). */
const EU_VAT_SPACED_DIGITS_PATTERN =
  /\b([A-Z]{2})[\s.\-/]([\dA-Z](?:[\s.\-/]?[\dA-Z]){4,17})\b/gi

/** NIF-IVA pegado sin separador (PT123456789, IE6388047V). */
const EU_VAT_STANDALONE_PATTERN = /\b([A-Z]{2}[0-9A-Z]{4,12})\b/gi

function normalizeEuVatCandidate(prefix: string, body: string): string | null {
  const country = prefix.toUpperCase()
  if (country === "ES") return null

  const normalizedCountry = country === "GR" ? "EL" : country
  if (!EU_VAT_COUNTRY_PREFIXES.has(normalizedCountry)) return null

  const normalizedBody = body.replace(/[\s.\-/]/g, "").toUpperCase()
  if (normalizedBody.length < 2 || normalizedBody.length > 12) return null

  const embeddedPrefix = normalizedBody.slice(0, 2)
  if (
    embeddedPrefix !== normalizedCountry &&
    EU_VAT_COUNTRY_PREFIXES.has(embeddedPrefix) &&
    normalizedBody.length > embeddedPrefix.length
  ) {
    return null
  }

  const vatId = `${normalizedCountry}${normalizedBody}`
  if (vatId.length < 4 || vatId.length > 14) return null
  return vatId
}

export function extractEuVatIds(text: string): string[] {
  const results: string[] = []
  const seen = new Set<string>()

  const pushMatch = (prefix: string, body: string) => {
    const normalized = normalizeEuVatCandidate(prefix, body)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    results.push(normalized)
  }

  for (const match of text.matchAll(EU_VAT_SPACED_DIGITS_PATTERN)) {
    pushMatch(match[1], match[2])
  }

  for (const match of text.matchAll(EU_VAT_COMPACT_PATTERN)) {
    pushMatch(match[1], match[2])
  }

  for (const match of text.matchAll(EU_VAT_STANDALONE_PATTERN)) {
    const candidate = match[1]
    pushMatch(candidate.slice(0, 2), candidate.slice(2))
  }

  return results.sort((a, b) => b.length - a.length)
}

export function extractPrimaryEuVatId(...texts: Array<string | null | undefined>): string | null {
  for (const text of texts) {
    if (!text) continue
    const match = extractEuVatIds(text)[0]
    if (match) return match
  }
  return null
}

export function isEuVatIdFormat(value: string): boolean {
  const normalized = value.replace(/[\s.\-/]/g, "").toUpperCase()
  if (normalized.length < 4 || normalized.length > 14) return false
  const prefix = normalized.startsWith("EL") ? "EL" : normalized.slice(0, 2)
  return EU_VAT_COUNTRY_PREFIXES.has(prefix)
}

export function formatEuVatIdForAeat(value: string): string {
  const normalized = value.replace(/[\s.\-/]/g, "").toUpperCase()
  if (normalized.startsWith("GR")) {
    return `EL${normalized.slice(2)}`
  }
  return normalized
}
