import { isGenericProviderCode } from "@/lib/imports/a3/native-account-code"
import type { A3JournalEntry, A3JournalLine, A3ThirdParty } from "@/lib/imports/a3/types"

const GENERIC_PROVIDER = "400000000000"

function needsProviderResolution(cuenta: string): boolean {
  const digits = cuenta.replace(/\D/g, "")
  return digits === GENERIC_PROVIDER || isGenericProviderCode(digits)
}

export function normalizeVendorKey(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(S\.?L\.?U?|S\.?A\.?|SLU|SCP|SC|SL|GMBH|LIMITED|LTD)\b/g, " ")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32)
}

export function extractVendorNameFromConcept(concept: string): string | null {
  const cleaned = concept
    .replace(/[^\x20-\x7E\u00C0-\u00FF.,\-/()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const patterns = [
    /Gasto a\s+(.+?)(?:\s+\d{4}[-/]\d+|\s+\d+\s|\s{2,}|$)/i,
    /IVA S\.\/?(.+?)(?:\s+\d{4}[-/]\d+|\s+\d+\s|\s{2,}|$)/i,
    /IVA R\.\/?(.+?)(?:\s+\d{4}[-/]\d+|\s+\d+\s|\s{2,}|$)/i,
    /Su Fra\.\s*N[ºo°.]?\s*(?:.+?\s+)?(.+?)(?:\s{2,}|$)/i,
    /Pago Fra\.\s*(?:\d+\s+)?(?:DE\s+)?(.+?)(?:\s{2,}|$)/i,
    /Traspaso Fra\.\s+(.+?)(?:\s{2,}|$)/i,
    /Transferencias\s+-\s+FR\s+[\d.]+\s+(.+?)(?:\s{2,}|$)/i,
    /Gasto a\s+(.+?)$/i,
    /IVA S\.\/?(.+?)$/i,
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match?.[1]) {
      const name = match[1].trim().replace(/\s+\d{4}[-/].*$/, "").trim()
      if (name.length >= 4) return name.slice(0, 60)
    }
  }

  return null
}

export function extractClientNameFromConcept(concept: string): string | null {
  const cleaned = concept
    .replace(/[^\x20-\x7E\u00C0-\u00FF.,\-/()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const patterns = [
    /Ventas a\s+(.+?)(?:\s+\d{4}[-/]|F\d{2}\s|\s{2,}|$)/i,
    /IVA R\.\/?(.+?)(?:\s+\d{4}[-/]|F\d{2}\s|\s{2,}|$)/i,
    /Reten\.\/?(.+?)(?:\s+\d{4}[-/]|\s+\d+\s|\s{2,}|$)/i,
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match?.[1]) {
      const name = match[1].trim().replace(/\s+\d{4}[-/].*$/, "").trim()
      if (name.length >= 4) return name.slice(0, 60)
    }
  }

  return null
}

function scoreVendorMatch(query: string, vendor: A3ThirdParty): number {
  const q = normalizeVendorKey(query)
  const v = normalizeVendorKey(vendor.name)
  if (!q || !v) return 0
  if (q === v) return 100
  if (v.includes(q) || q.includes(v)) return 85

  const qTokens = q.match(/.{4,}/g) ?? []
  let score = 0
  for (const token of qTokens) {
    if (v.includes(token)) score += token.length
  }
  return score
}

export function findVendorForConcept(concept: string, vendors: A3ThirdParty[]): A3ThirdParty | null {
  const extracted = extractVendorNameFromConcept(concept)
  if (!extracted) return null

  let best: A3ThirdParty | null = null
  let bestScore = 0

  for (const vendor of vendors) {
    const score = scoreVendorMatch(extracted, vendor)
    if (score > bestScore) {
      bestScore = score
      best = vendor
    }
  }

  return bestScore >= 8 ? best : null
}

export function applyVendorMatchingToEntries(
  entries: A3JournalEntry[],
  vendors: A3ThirdParty[],
): { entries: A3JournalEntry[]; matchedVendorCifs: Set<string> } {
  const matchedVendorCifs = new Set<string>()

  const nextEntries = entries.map((entry) => {
    const entryVendor =
      findVendorForConcept(entry.concepto, vendors) ??
      entry.lines.reduce<A3ThirdParty | null>((found, line) => {
        if (found) return found
        return findVendorForConcept(line.concepto, vendors)
      }, null)

    const lines = entry.lines.map((line) => mapLineVendor(line, vendors, entryVendor, matchedVendorCifs))
    return { ...entry, lines }
  })

  return { entries: nextEntries, matchedVendorCifs }
}

function mapLineVendor(
  line: A3JournalLine,
  vendors: A3ThirdParty[],
  entryVendor: A3ThirdParty | null,
  matchedVendorCifs: Set<string>,
): A3JournalLine {
  const needsProvider = needsProviderResolution(line.cuenta)

  if (!needsProvider) return line

  const vendor = findVendorForConcept(line.concepto, vendors) ?? entryVendor
  if (!vendor) return line

  matchedVendorCifs.add(vendor.cif)
  return {
    ...line,
    cuenta: vendor.accountCode && !isGenericProviderCode(vendor.accountCode) ? vendor.accountCode : line.cuenta,
    vendorCif: vendor.cif,
    vendorName: vendor.name,
  }
}

export function resolveVendorAccountCodes(
  entries: A3JournalEntry[],
  accountByCif: Map<string, string>,
): A3JournalEntry[] {
  return entries.map((entry) => ({
    ...entry,
    lines: entry.lines.map((line) => {
      if (!line.vendorCif) return line
      if (!needsProviderResolution(line.cuenta)) return line
      const accountCode = accountByCif.get(line.vendorCif)
      if (!accountCode) return line
      return { ...line, cuenta: accountCode }
    }),
  }))
}
