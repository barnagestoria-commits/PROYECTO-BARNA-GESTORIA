import { normalizeCif } from "@/lib/accounting/third-party-types"
import {
  decodeTcliproRecordAccount,
  findTcliproRecordStarts,
  pickPreferredTcliproRecord,
  TCLIPRO_RECORD_SIZE,
} from "@/lib/imports/a3/a3-tclipro-account"
import { decodeA3Text, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import { isProviderAccountCode, padAccountCode12 } from "@/lib/imports/a3/native-account-code"
import type { A3Subaccount, A3ThirdParty } from "@/lib/imports/a3/types"

const NIF_PATTERN =
  /([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[A-Z]{2}\d{2,12}|\d{8,12}[A-Z0-9])/i

const ADDRESS_MARKERS = [/\x0b\.CL/i, /\x0b\.AV/i, /\x0b\.A\./i, /^\s*CL\s+/i, /^\s*AV\s+/i]

function cleanVendorName(raw: string): string {
  return raw
    .replace(/\x00/g, " ")
    .replace(/[\x01-\x08\x0E-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
}

function isPlausibleVendorName(name: string): boolean {
  if (name.length < 4) return false
  const upper = name.toUpperCase()
  const blocked = [
    "BARCELONA",
    "MADRID",
    "SEPULVEDA",
    "CADIZ",
    "CORNELLA",
    "CHICLANA",
    "ZARAGOZA",
    "ENTEN",
    "LARGA",
  ]
  if (blocked.some((token) => upper === token || upper.startsWith(`${token} `))) return false
  if (/^\d+$/.test(name)) return false
  return /[A-ZÁÉÍÓÚÑ]/i.test(name)
}

function extractNameAfterNif(text: string, nifEndIndex: number): string {
  const tail = text.slice(nifEndIndex)
  const markerIndex = ADDRESS_MARKERS.reduce((idx, pattern) => {
    const match = tail.match(pattern)
    if (!match || match.index === undefined) return idx
    return idx < 0 ? match.index : Math.min(idx, match.index)
  }, -1)

  const raw = markerIndex >= 0 ? tail.slice(0, markerIndex) : tail.slice(0, 60)
  return cleanVendorName(raw)
}

function extractNifFromRecord(record: ImportBytes): string | null {
  const text = decodeA3Text(record)
  const match = text.match(NIF_PATTERN)
  if (!match?.[1]) return null
  return normalizeCif(match[1]) ?? null
}

function extractNameFromRecord(record: ImportBytes): string {
  const text = decodeA3Text(record)
  const match = text.match(NIF_PATTERN)
  if (!match?.index) return ""
  const end = match.index + match[0].length
  return extractNameAfterNif(text, end)
}

export function parseTcliproSubaccounts(buffer: ImportBytes): A3Subaccount[] {
  const starts = findTcliproRecordStarts(buffer)
  const recordsByNif = new Map<string, ImportBytes[]>()
  const recordsByName = new Map<string, ImportBytes[]>()

  for (const start of starts) {
    const record = buffer.subarray(start, start + TCLIPRO_RECORD_SIZE)
    const nif = extractNifFromRecord(record)
    const name = extractNameFromRecord(record)
    if (!isPlausibleVendorName(name)) continue

    const nameKey = name.toUpperCase()
    if (nif) {
      const list = recordsByNif.get(nif) ?? []
      list.push(record)
      recordsByNif.set(nif, list)
    } else {
      const list = recordsByName.get(nameKey) ?? []
      list.push(record)
      recordsByName.set(nameKey, list)
    }
  }

  const subaccounts: A3Subaccount[] = []
  const seenNif = new Set<string>()
  const seenName = new Set<string>()

  const pushSubaccount = (record: ImportBytes, nif: string | null, name: string) => {
    const accountCode = decodeTcliproRecordAccount(record)
    if (!accountCode || !isProviderAccountCode(accountCode)) return

    const nameKey = name.toUpperCase()
    if (nif && seenNif.has(nif)) return
    if (seenName.has(nameKey)) return

    if (nif) seenNif.add(nif)
    seenName.add(nameKey)

    subaccounts.push({
      accountCode: padAccountCode12(accountCode),
      name,
      nif: nif ?? undefined,
    })
  }

  for (const [nif, records] of recordsByNif) {
    const preferred = pickPreferredTcliproRecord(records)
    if (!preferred) continue
    const name = extractNameFromRecord(preferred)
    if (!isPlausibleVendorName(name)) continue
    pushSubaccount(preferred, nif, name)
  }

  for (const [nameKey, records] of recordsByName) {
    const preferred = pickPreferredTcliproRecord(records)
    if (!preferred) continue
    const name = extractNameFromRecord(preferred)
    if (!isPlausibleVendorName(name)) continue
    pushSubaccount(preferred, extractNifFromRecord(preferred), name)
  }

  return subaccounts
}

/** @deprecated Preferir parseTcliproSubaccounts para obtener también la cuenta contable. */
export function parseTcliproBuffer(buffer: ImportBytes): A3ThirdParty[] {
  return parseTcliproSubaccounts(buffer).map((sub) => ({
    cif: sub.nif ?? "",
    name: sub.name,
    type: "PROVEEDOR" as const,
    accountCode: sub.accountCode,
  }))
}

export function buildAccountMapByCif(subaccounts: A3Subaccount[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const sub of subaccounts) {
    if (!sub.nif) continue
    const normalized = normalizeCif(sub.nif)
    if (!normalized) continue
    map.set(normalized, padAccountCode12(sub.accountCode))
  }
  return map
}
