import { decodeA3Text, decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import { padAccountCode12 } from "@/lib/imports/a3/native-account-code"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import type { A3FixedAsset, A3FixedAssetDefaults } from "@/lib/imports/a3/types"

const AAM_HEADER_SIZE = 128
const AAM_RECORD_SIZE = 100
const AAM_MARKER_PREFIX = Buffer.from("@`1", "latin1")
const AAM_NAME_MARKER_PREFIX = Buffer.from("@`2", "latin1")
const AAM_PERIOD_MARKER_PREFIX = Buffer.from("@`3", "latin1")

const DEFAULT_ASSET_ACCOUNTS: A3FixedAssetDefaults = {
  cuentaInmovilizado: padAccountCode12("213"),
  cuentaAmortAcumulada: padAccountCode12("2813"),
  cuentaGastoAmort: padAccountCode12("6813"),
}

/** Elemento A3 → cuentas PGC habituales de la ficha. */
const ELEMENT_ACCOUNTS: Record<string, { inmov: string; amort: string; gasto: string; name: string }> = {
  "0": { inmov: "206", amort: "2806", gasto: "680", name: "Aplicaciones informáticas" },
  "1": { inmov: "213", amort: "2813", gasto: "6813", name: "Maquinaria" },
  "2": { inmov: "216", amort: "2816", gasto: "6816", name: "Mobiliario" },
  "3": { inmov: "217", amort: "2817", gasto: "6817", name: "Equipos para procesos de información" },
  "4": { inmov: "218", amort: "2818", gasto: "6818", name: "Elementos de transporte" },
  "5": { inmov: "215", amort: "2815", gasto: "6815", name: "Otras instalaciones" },
  "6": { inmov: "212", amort: "2812", gasto: "6812", name: "Instalaciones técnicas" },
  "7": { inmov: "214", amort: "2814", gasto: "6814", name: "Utillaje" },
  "8": { inmov: "219", amort: "2819", gasto: "6819", name: "Otro inmovilizado material" },
  "9": { inmov: "211", amort: "2811", gasto: "6811", name: "Construcciones" },
}

function bytesEqual(left: ImportBytes, right: ImportBytes): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function markerMatches(record: ImportBytes, prefix: ImportBytes): boolean {
  return record.length >= prefix.length && bytesEqual(record.subarray(0, prefix.length), prefix)
}

function readUInt32LE(buffer: ImportBytes, offset: number): number {
  if (offset + 4 > buffer.length) return 0
  return (
    (buffer[offset]! |
      (buffer[offset + 1]! << 8) |
      (buffer[offset + 2]! << 16) |
      (buffer[offset + 3]! << 24)) >>>
    0
  )
}

function centsToAmount(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.round(raw) / 100
}

function a3PackedYear(high: number, low: number): number | null {
  const current = new Date().getUTCFullYear() + 1
  const big = (high << 8) | low
  const little = high | (low << 8)
  if (big >= 1990 && big <= current) return big
  if (little >= 1990 && little <= current) return little
  return null
}

function formatDate(year: number, month = 1, day = 1): string {
  const safeMonth = Math.min(12, Math.max(1, month))
  const safeDay = Math.min(28, Math.max(1, day))
  return `${year}-${String(safeMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`
}

function cleanA3AssetName(raw: string): string {
  const trimmed = raw.replace(/[S.$]+$/u, "").replace(/^[.$]+/u, "").trim()
  if (trimmed.length < 3) return ""
  if (/^S+$/u.test(trimmed) || /^D+$/u.test(trimmed)) return ""
  if (/^[A-Z]?S{3,}/u.test(trimmed) && trimmed.replace(/[DS.$]/g, "").length < 3) return ""
  return trimmed
}

function readA3PaddedName(buffer: ImportBytes, offset: number, width = 32): string {
  const slice = buffer.subarray(offset, Math.min(buffer.length, offset + width))
  let end = 0
  while (end < slice.length && slice[end] !== 0) end++
  return cleanA3AssetName(decodeLatin1(slice.subarray(0, end)))
}

function collectMarkedRecords(buffer: ImportBytes, prefix: ImportBytes): ImportBytes[] {
  const records: ImportBytes[] = []
  for (let offset = AAM_HEADER_SIZE; offset + AAM_RECORD_SIZE <= buffer.length; offset++) {
    if (!markerMatches(buffer.subarray(offset, offset + prefix.length), prefix)) continue
    records.push(buffer.subarray(offset, offset + AAM_RECORD_SIZE))
  }
  return records
}

function isValidM1Record(record: ImportBytes): boolean {
  if (!markerMatches(record, AAM_MARKER_PREFIX)) return false
  const elementByte = record[11]!
  if (elementByte < 0x30 || elementByte > 0x39) return false
  const costCents = readUInt32LE(record, 24)
  return costCents > 0 && costCents <= 10_000_000_000
}

function parseAssetCodeFromM3Record(record: ImportBytes): string | null {
  const match = decodeLatin1(record.subarray(4, 12)).match(/^(\d{8})$/)
  return match?.[1] ?? null
}

function buildNameByAssetCode(buffer: ImportBytes): Map<string, string> {
  const map = new Map<string, string>()
  const m2Records = collectMarkedRecords(buffer, AAM_NAME_MARKER_PREFIX)
  const m3Records = collectMarkedRecords(buffer, AAM_PERIOD_MARKER_PREFIX)

  for (const record of m2Records) {
    const name = readA3PaddedName(record, 20)
    if (name.length < 2) continue
    const year = a3PackedYear(record[12]!, record[13]!)
    for (const period of m3Records) {
      const code = parseAssetCodeFromM3Record(period)
      if (!code || map.has(code)) continue
      const periodYear = a3PackedYear(period[12]!, period[13]!)
      if (year && periodYear && year !== periodYear) continue
      map.set(code, name)
    }
  }

  return map
}

function averagePeriodAmort(buffer: ImportBytes, code: string, maxCost: number): number {
  const amounts: number[] = []
  for (const record of collectMarkedRecords(buffer, AAM_PERIOD_MARKER_PREFIX)) {
    if (parseAssetCodeFromM3Record(record) !== code) continue
    const amount = centsToAmount(readUInt32LE(record, 36))
    if (amount > 0 && amount < maxCost * 0.5) amounts.push(amount)
  }
  if (amounts.length < 2) return 0
  return amounts.reduce((sum, value) => sum + value, 0) / amounts.length
}

function inferUsefulLifeMonths(cost: number, accumulated: number, periodAmort: number): number {
  if (periodAmort > 0 && cost > periodAmort) {
    const months = Math.round(cost / periodAmort)
    if (months >= 12 && months <= 600) return months
  }

  if (accumulated > 0 && accumulated < cost * 0.95) {
    const remaining = cost - accumulated
    const impliedAnnual = accumulated / Math.max(1, remaining)
    if (impliedAnnual > 0) {
      const months = Math.round(12 / impliedAnnual)
      if (months >= 12 && months <= 600) return months
    }
  }

  return 120
}

function formatAssetCode(index: number): string {
  return String(index).padStart(8, "0")
}

function accountsForElement(elementType: string, defaults: A3FixedAssetDefaults) {
  const mapped = ELEMENT_ACCOUNTS[elementType]
  if (!mapped) {
    return {
      cuentaInmovilizado: defaults.cuentaInmovilizado,
      cuentaAmortAcumulada: defaults.cuentaAmortAcumulada,
      cuentaGastoAmort: defaults.cuentaGastoAmort,
      fallbackName: `Activo`,
    }
  }
  return {
    cuentaInmovilizado: padAccountCode12(mapped.inmov),
    cuentaAmortAcumulada: padAccountCode12(mapped.amort),
    cuentaGastoAmort: padAccountCode12(mapped.gasto),
    fallbackName: mapped.name,
  }
}

function pickAccountByLabel(text: string, prefixes: string[], label: RegExp): string | null {
  const windowed = text.match(new RegExp(`.{0,80}${label.source}.{0,80}`, "gi")) ?? []
  for (const chunk of windowed) {
    for (const prefix of prefixes) {
      const match = chunk.match(new RegExp(`\\b(${prefix}\\d{0,8})\\b`))
      if (!match) continue
      const digits = match[1]!.replace(/\D/g, "")
      if (digits.length >= 3 && digits.length <= 12) return padAccountCode12(digits)
    }
  }
  return null
}

function pickBestAccount(text: string, prefixes: string[], fallback: string): string {
  const candidates: string[] = []
  for (const prefix of prefixes) {
    const matches = [...text.matchAll(new RegExp(`\\b(${prefix}\\d{0,9})\\b`, "g"))].map((match) => match[1]!)
    for (const code of matches) {
      const digits = code.replace(/\D/g, "")
      if (digits.length < 3 || digits.length > 12) continue
      if (/^2810{3,}/.test(digits) || /^6810{3,}/.test(digits)) continue
      if (digits.startsWith("472") || digits.startsWith("477")) continue
      candidates.push(digits)
    }
  }

  if (candidates.length === 0) return padAccountCode12(fallback)

  candidates.sort((left, right) => {
    const leftSpecific = left.replace(/0+$/, "").length
    const rightSpecific = right.replace(/0+$/, "").length
    return rightSpecific - leftSpecific || left.length - right.length
  })

  return padAccountCode12(candidates[0]!)
}

export function parseTpPredefiAssetDefaults(buffer: ImportBytes): A3FixedAssetDefaults {
  if (buffer.length === 0) return { ...DEFAULT_ASSET_ACCOUNTS }
  const text = decodeA3Text(buffer)
  return {
    cuentaInmovilizado:
      pickAccountByLabel(text, ["213", "216", "217", "212", "21"], /INMOVIL/i) ??
      pickBestAccount(text, ["213", "216", "217", "212", "21"], DEFAULT_ASSET_ACCOUNTS.cuentaInmovilizado),
    cuentaAmortAcumulada:
      pickAccountByLabel(text, ["2813", "2817", "2816", "281", "280"], /AMORTIZACION INMOV/i) ??
      pickBestAccount(text, ["2813", "2817", "2816", "281"], DEFAULT_ASSET_ACCOUNTS.cuentaAmortAcumulada),
    cuentaGastoAmort:
      pickAccountByLabel(text, ["6813", "6817", "6816", "681", "680"], /AMORTIZACION INMOV/i) ??
      pickBestAccount(text, ["6813", "6817", "6816", "681"], DEFAULT_ASSET_ACCOUNTS.cuentaGastoAmort),
  }
}

export interface ParseAamDatOptions {
  fiscalYear?: number | null
  defaults?: A3FixedAssetDefaults
}

interface M1AssetDraft {
  elementType: string
  year: number | null
  acquisitionCost: number
  accumulatedAmort: number
}

function collapseAnnualHistory(records: M1AssetDraft[]): M1AssetDraft[] {
  const grouped = new Map<string, M1AssetDraft[]>()
  for (const record of records) {
    const list = grouped.get(record.elementType) ?? []
    list.push(record)
    grouped.set(record.elementType, list)
  }

  const assets: M1AssetDraft[] = []
  for (const list of grouped.values()) {
    const byCost = new Map<number, M1AssetDraft[]>()
    for (const item of list) {
      const bucket = byCost.get(item.acquisitionCost) ?? []
      bucket.push(item)
      byCost.set(item.acquisitionCost, bucket)
    }
    for (const bucket of byCost.values()) {
      const latest = [...bucket].sort((left, right) => (right.year ?? 0) - (left.year ?? 0))[0]!
      assets.push(latest)
    }
  }
  return assets.sort(
    (left, right) =>
      Number(left.elementType) - Number(right.elementType) ||
      (left.year ?? 0) - (right.year ?? 0) ||
      left.acquisitionCost - right.acquisitionCost,
  )
}

export function parseAamDatFixedAssets(
  buffer: ImportBytes,
  options: ParseAamDatOptions = {},
): A3FixedAsset[] {
  if (buffer.length <= AAM_HEADER_SIZE + AAM_RECORD_SIZE) return []

  const defaults = options.defaults ?? DEFAULT_ASSET_ACCOUNTS
  const fiscalYear = options.fiscalYear ?? new Date().getFullYear()
  const m1Records = collectMarkedRecords(buffer, AAM_MARKER_PREFIX).filter(isValidM1Record)
  if (m1Records.length === 0) return []

  const drafts: M1AssetDraft[] = m1Records.map((record) => {
    const year = a3PackedYear(record[12]!, record[13]!)
    const acquisitionCost = centsToAmount(readUInt32LE(record, 24))
    const accumulatedAmort = centsToAmount(readUInt32LE(record, 36))
    return {
      elementType: String.fromCharCode(record[11] ?? 0x31),
      year,
      acquisitionCost,
      accumulatedAmort: Math.min(accumulatedAmort, acquisitionCost),
    }
  })

  const collapsed = collapseAnnualHistory(drafts)
  const nameByCode = buildNameByAssetCode(buffer)
  const assets: A3FixedAsset[] = []

  collapsed.forEach((draft, index) => {
    if (draft.acquisitionCost <= 0) return
    const code = formatAssetCode(index + 1)
    const periodAmort = averagePeriodAmort(buffer, code, draft.acquisitionCost)
    const usefulLifeMonths = inferUsefulLifeMonths(
      draft.acquisitionCost,
      draft.accumulatedAmort,
      periodAmort,
    )
    const accounts = accountsForElement(draft.elementType, defaults)
    const named = nameByCode.get(code)
    const chartName = getAccountLabel(accounts.cuentaInmovilizado)
    const name = named || accounts.fallbackName || chartName || `Activo ${Number.parseInt(code, 10)}`

    assets.push({
      code,
      name,
      elementType: draft.elementType,
      cuentaInmovilizado: accounts.cuentaInmovilizado,
      cuentaAmortAcumulada: accounts.cuentaAmortAcumulada,
      cuentaGastoAmort: accounts.cuentaGastoAmort,
      acquisitionDate: formatDate(draft.year ?? fiscalYear),
      acquisitionCost: draft.acquisitionCost,
      residualValue: 0,
      usefulLifeMonths,
      accumulatedAmort: draft.accumulatedAmort,
      isActive: draft.accumulatedAmort < draft.acquisitionCost - 0.01,
    })
  })

  return assets
}

export function isAamDatBuffer(buffer: ImportBytes): boolean {
  const head = decodeLatin1(buffer.slice(0, 2))
  if (head !== "0~") return false
  return collectMarkedRecords(buffer, AAM_MARKER_PREFIX).length > 0
}
