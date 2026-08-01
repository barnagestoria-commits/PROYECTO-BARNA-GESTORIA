import { normalizeCif } from "@/lib/accounting/third-party-types"
import type { A3ThirdParty } from "@/lib/imports/a3/types"

const NIF_PATTERN =
  /([A-HJ-NP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[A-Z]{2}\d{2,12}|\d{8,12}[A-Z0-9])/gi

const ADDRESS_MARKERS = [/\x0b\.CL/i, /\x0b\.AV/i, /\x0b\.A\./i, /^\s*CL\s+/i, /^\s*AV\s+/i]

import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"

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

export function parseTcliproBuffer(buffer: ImportBytes): A3ThirdParty[] {
  const text = decodeLatin1(buffer)
  const vendors: A3ThirdParty[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(NIF_PATTERN)) {
    const rawNif = match[1].trim()
    const normalized = normalizeCif(rawNif)
    if (!normalized || normalized.length < 8) continue
    if (seen.has(normalized)) continue

    const name = extractNameAfterNif(text, (match.index ?? 0) + match[0].length)
    if (!isPlausibleVendorName(name)) continue

    seen.add(normalized)
    vendors.push({
      cif: normalized,
      name,
      type: "PROVEEDOR",
    })
  }

  return vendors
}
