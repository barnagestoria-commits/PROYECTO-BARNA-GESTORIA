import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import { extractPrimaryEuVatId, formatEuVatIdForAeat } from "@/lib/fiscal/eu-vat-id"
import { normalizeCuenta } from "@/lib/reports/format"
import { normalizeTaxId } from "@/lib/tax-id"
import type { FiscalModelBreakdownLine } from "@/lib/types/fiscal-panorama"

export interface PartyDirectoryRecord {
  accountCode: string
  cif: string
  name: string
}

const SPANISH_TAX_ID_IN_TEXT =
  /\b([XYZ][\s.-]?\d{7}[\s.-]?[A-Z]|[ABCDEFGHJNPQRSUVW][\s.-]?\d{7}[\s.-]?[0-9A-J]|\d{8}[\s.-]?[A-Z])\b/gi

const PARTY_ACCOUNT_PREFIXES = ["430", "400", "410", "440", "401", "411", "431"] as const

export function extractSpanishTaxId(text: string): string | null {
  if (!text.trim()) return null
  for (const match of text.matchAll(SPANISH_TAX_ID_IN_TEXT)) {
    const candidate = normalizeTaxId(match[1] ?? "")
    if (candidate.length === 9) return candidate
  }
  return null
}

export function extractPartyDisplayName(concepto: string): string {
  let text = concepto.trim()
  const ivaMatch = text.match(/^IVA\s+[SR]\.\/(.+)$/i)
  if (ivaMatch) text = ivaMatch[1].trim()
  const retenMatch = text.match(/^"?Reten\.\/(.+)$/i)
  if (retenMatch) text = retenMatch[1].trim()
  const gastoMatch = text.match(/^Gasto a\s+(.+)$/i)
  if (gastoMatch) text = gastoMatch[1].trim()
  const ventasMatch = text.match(/^Ventas a\s+(.+)$/i)
  if (ventasMatch) text = ventasMatch[1].trim()

  const euVat = extractPrimaryEuVatId(text)
  if (euVat && /\d/.test(euVat)) {
    text = stripIdentifier(text, euVat)
    const formatted = formatEuVatIdForAeat(euVat)
    if (formatted !== euVat) text = stripIdentifier(text, formatted)
  }

  const spanish = extractSpanishTaxId(text)
  if (spanish) text = stripIdentifier(text, spanish)

  text = text.replace(/\s+/g, " ").replace(/^[\s,;./-]+|[\s,;./-]+$/g, "").trim()
  return text.slice(0, 80)
}

export function normalizePartyTaxId(value: string): string {
  const compact = normalizeTaxId(value)
  if (!compact) return ""
  const euVat = extractPrimaryEuVatId(compact)
  if (euVat) return formatEuVatIdForAeat(euVat)
  return compact
}

export function buildPartyAccountIndex(
  directory: PartyDirectoryRecord[],
): Map<string, PartyDirectoryRecord> {
  const index = new Map<string, PartyDirectoryRecord>()
  for (const party of directory) {
    if (!party.accountCode) continue
    const key = partyAccountKey(party.accountCode)
    if (key) index.set(key, party)
    for (const variant of accountCodeLookupVariants(party.accountCode)) {
      index.set(variant, party)
      const digits = normalizeCuenta(variant)
      if (digits) index.set(digits, party)
    }
  }
  return index
}

export function lookupPartyByAccount(
  cuenta: string,
  index: Map<string, PartyDirectoryRecord>,
): PartyDirectoryRecord | undefined {
  const digits = normalizeCuenta(cuenta)
  if (digits.length >= 4) {
    const exact = index.get(digits) ?? index.get(cuenta.trim())
    if (exact) return exact
  }
  const key = partyAccountKey(cuenta)
  return key ? index.get(key) : undefined
}

export function resolvePartyIdentity(params: {
  cuenta: string
  concepto: string
  entryConcept?: string
  siblingLines: Array<{ cuenta: string; concepto: string }>
  directoryIndex: Map<string, PartyDirectoryRecord>
}): { nif: string | null; nombre: string | null } {
  const party = findPartyForLine(params.cuenta, params.siblingLines, params.directoryIndex)
  const combinedText = [
    params.concepto,
    params.entryConcept ?? "",
    ...params.siblingLines.map((line) => line.concepto),
  ].join(" ")

  const nifFromParty = party?.cif ? normalizePartyTaxId(party.cif) : ""
  const nifFromText =
    extractSpanishTaxId(combinedText) ?? extractPrimaryEuVatId(combinedText)

  const nif = nifFromParty || (nifFromText ? normalizePartyTaxId(nifFromText) : "") || null
  const nombreFromParty = party?.name?.trim() || ""
  const nombreFromConcept = extractPartyDisplayName(params.concepto)
  const nombre = nombreFromParty || nombreFromConcept || null

  return { nif, nombre }
}

export function enrichBreakdownWithPartyIdentity<
  T extends {
    key: string
    label: string
    total: number
    lines: FiscalModelBreakdownLine[]
  },
>(
  breakdown: T[],
  allLines: Array<{ entryId: string; cuenta: string; concepto: string }>,
  directory: PartyDirectoryRecord[],
): T[] {
  const directoryIndex = buildPartyAccountIndex(directory)
  const siblingsByEntry = new Map<string, Array<{ cuenta: string; concepto: string }>>()
  for (const line of allLines) {
    const list = siblingsByEntry.get(line.entryId) ?? []
    list.push({ cuenta: line.cuenta, concepto: line.concepto })
    siblingsByEntry.set(line.entryId, list)
  }

  return breakdown.map((section) => ({
    ...section,
    lines: section.lines.map((line) => {
      const identity = resolvePartyIdentity({
        cuenta: line.cuenta,
        concepto: line.concepto,
        entryConcept: line.entryConcept,
        siblingLines: siblingsByEntry.get(line.entryId) ?? [],
        directoryIndex,
      })
      return {
        ...line,
        nif: identity.nif ?? undefined,
        nombre: identity.nombre ?? undefined,
      }
    }),
  }))
}

function findPartyForLine(
  cuenta: string,
  siblingLines: Array<{ cuenta: string; concepto: string }>,
  directoryIndex: Map<string, PartyDirectoryRecord>,
): PartyDirectoryRecord | undefined {
  const fromCurrent = lookupPartyByAccount(cuenta, directoryIndex)
  if (fromCurrent) return fromCurrent

  for (const candidate of orderedSiblingAccounts(cuenta, siblingLines)) {
    const found = lookupPartyByAccount(candidate, directoryIndex)
    if (found) return found
  }
  return undefined
}

function orderedSiblingAccounts(
  cuenta: string,
  siblingLines: Array<{ cuenta: string; concepto: string }>,
): string[] {
  const prefixes = preferredPartyPrefixes(cuenta)
  const partyAccounts = siblingLines
    .map((line) => line.cuenta)
    .filter((candidate) => isPartyAccount(candidate) && normalizeCuenta(candidate) !== normalizeCuenta(cuenta))

  const ordered: string[] = []
  for (const prefix of prefixes) {
    for (const candidate of partyAccounts) {
      if (normalizeCuenta(candidate).startsWith(prefix) && !ordered.includes(candidate)) {
        ordered.push(candidate)
      }
    }
  }
  for (const candidate of partyAccounts) {
    if (!ordered.includes(candidate)) ordered.push(candidate)
  }
  return ordered
}

function preferredPartyPrefixes(cuenta: string): string[] {
  const digits = normalizeCuenta(cuenta)
  if (digits.startsWith("477") || digits.startsWith("7") || digits.startsWith("43")) {
    return ["430", "440", "431", "400", "410"]
  }
  if (digits.startsWith("472") || digits.startsWith("6") || digits.startsWith("40") || digits.startsWith("41")) {
    return ["400", "410", "401", "411", "430"]
  }
  if (digits.startsWith("4751") || digits.startsWith("473")) {
    return ["410", "400", "430"]
  }
  return [...PARTY_ACCOUNT_PREFIXES]
}

function isPartyAccount(cuenta: string): boolean {
  const digits = normalizeCuenta(cuenta)
  if (digits.length < 4) return false
  return PARTY_ACCOUNT_PREFIXES.some((prefix) => digits.startsWith(prefix))
}

function partyAccountKey(cuenta: string): string | null {
  const digits = normalizeCuenta(cuenta)
  if (digits.length < 4) return null
  const group = digits.slice(0, 3)
  const sequence = Number.parseInt(digits.slice(3), 10)
  if (!Number.isFinite(sequence)) return null
  return `${group}:${sequence}`
}

function stripIdentifier(text: string, identifier: string): string {
  const compact = identifier.replace(/[^A-Z0-9]/gi, "")
  if (!compact) return text
  const pattern = compact.split("").join("[\\s.\\-/]*")
  return text.replace(new RegExp(pattern, "i"), " ")
}
