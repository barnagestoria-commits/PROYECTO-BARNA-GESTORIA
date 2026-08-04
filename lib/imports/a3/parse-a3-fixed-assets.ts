import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"
import { padAccountCode12 } from "@/lib/imports/a3/native-account-code"
import type { A3FixedAsset, A3FixedAssetDefaults } from "@/lib/imports/a3/types"

const AAM_HEADER_SIZE = 512
const AAM_RECORD_SIZE = 100
const AAM_ASSET_CHUNK_SIZE = 8
const AAM_MARKER_M1 = Buffer.from("@`1\x00", "latin1")
const AAM_MARKER_M2 = Buffer.from("@`2\x00", "latin1")
const AAM_MARKER_M3 = Buffer.from("@`3\x00", "latin1")

const DEFAULT_ASSET_ACCOUNTS: A3FixedAssetDefaults = {
  cuentaInmovilizado: padAccountCode12("21300000"),
  cuentaAmortAcumulada: padAccountCode12("28130000"),
  cuentaGastoAmort: padAccountCode12("68130000"),
}

function readUInt32LE(buffer: ImportBytes, offset: number): number {
  if (offset + 4 > buffer.length) return 0
  return (
    buffer[offset]! |
    (buffer[offset + 1]! << 8) |
    (buffer[offset + 2]! << 16) |
    (buffer[offset + 3]! << 24)
  )
}

function centsToAmount(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.round(raw) / 100
}

function isValidM1Record(record: ImportBytes): boolean {
  if (record.length < AAM_RECORD_SIZE) return false
  if (!bytesEqual(record.subarray(0, 4), AAM_MARKER_M1)) return false

  const elementByte = record[11]!
  if (elementByte < 0x30 || elementByte > 0x39) return false

  const costCents = readUInt32LE(record, 24)
  if (costCents <= 0 || costCents > 10_000_000_000) return false

  return true
}

function collectM1Records(buffer: ImportBytes): ImportBytes[] {
  const records: ImportBytes[] = []
  const text = decodeLatin1(buffer)
  const markerPattern = /@`1\x00/g
  let match: RegExpExecArray | null

  while ((match = markerPattern.exec(text)) !== null) {
    const offset = match.index
    if (offset + AAM_RECORD_SIZE > buffer.length) break
    const record = buffer.subarray(offset, offset + AAM_RECORD_SIZE)
    if (!isValidM1Record(record)) continue
    records.push(record)
  }

  return records
}

function cleanA3AssetName(raw: string): string {
  const trimmed = raw.replace(/S+$/u, "").trim()
  const match = trimmed.match(/^(.+?)(?:S{3,})?$/u)
  const candidate = (match?.[1] ?? trimmed).trim()
  if (candidate.length < 2 || /^S+$/u.test(candidate)) return ""
  return candidate
}

function readA3PaddedName(buffer: ImportBytes, offset: number, width = 32): string {
  const slice = buffer.subarray(offset, offset + width)
  let end = 0
  while (end < slice.length && slice[end] !== 0) end++
  return cleanA3AssetName(decodeLatin1(slice.subarray(0, end)))
}

function bytesEqual(left: ImportBytes, right: ImportBytes): boolean {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function findMarkerOffsets(buffer: ImportBytes, marker: Buffer): number[] {
  const offsets: number[] = []
  for (let i = AAM_HEADER_SIZE; i <= buffer.length - marker.length; i++) {
    if (bytesEqual(buffer.subarray(i, i + marker.length), marker)) {
      offsets.push(i)
    }
  }
  return offsets
}

function parseAssetCodeFromM3Record(record: ImportBytes): string | null {
  const match = decodeLatin1(record.subarray(4, 12)).match(/^(\d{8})$/)
  return match?.[1] ?? null
}

function buildNameByAssetCode(buffer: ImportBytes): Map<string, string> {
  const map = new Map<string, string>()
  const m2Offsets = findMarkerOffsets(buffer, AAM_MARKER_M2)

  for (let index = 0; index < m2Offsets.length; index++) {
    const start = m2Offsets[index]!
    const end = m2Offsets[index + 1] ?? buffer.length
    const name = readA3PaddedName(buffer, start + 20)
    if (name.length < 2) continue

    const block = buffer.subarray(start, end)
    for (let offset = 0; offset <= block.length - AAM_RECORD_SIZE; offset++) {
      if (!bytesEqual(block.subarray(offset, offset + 4), AAM_MARKER_M3)) continue
      const record = block.subarray(offset, offset + AAM_RECORD_SIZE)
      const code = parseAssetCodeFromM3Record(record)
      if (!code) continue
      if (!map.has(code)) {
        map.set(code, name)
      }
    }
  }

  return map
}

function averagePeriodAmort(buffer: ImportBytes, code: string, maxCost: number): number {
  const amounts: number[] = []

  for (let offset = AAM_HEADER_SIZE; offset <= buffer.length - AAM_RECORD_SIZE; offset++) {
    if (!bytesEqual(buffer.subarray(offset, offset + 4), AAM_MARKER_M3)) continue
    const record = buffer.subarray(offset, offset + AAM_RECORD_SIZE)
    if (parseAssetCodeFromM3Record(record) !== code) continue

    const amount = centsToAmount(readUInt32LE(record, 36))
    if (amount > 0 && amount < maxCost) {
      amounts.push(amount)
    }
  }

  if (amounts.length === 0) return 0
  return amounts.reduce((sum, value) => sum + value, 0) / amounts.length
}

function inferUsefulLifeMonths(cost: number, accumulated: number, periodAmort: number): number {
  if (periodAmort > 0 && cost > accumulated) {
    const months = Math.round((cost - accumulated) / periodAmort)
    if (months >= 12 && months <= 600) return months
  }

  if (accumulated > 0 && cost > accumulated) {
    const impliedAnnual = accumulated / Math.max(1, cost - accumulated)
    const months = Math.round(12 / impliedAnnual)
    if (months >= 12 && months <= 600) return months
  }

  return 120
}

function formatAssetCode(index: number): string {
  return String(index).padStart(8, "0")
}

function pickBestAccount(text: string, prefix: string, fallback: string): string {
  const matches = [...text.matchAll(new RegExp(`(${prefix}\\d{6,11})`, "g"))]
    .map((match) => match[1]!)
    .filter((code) => {
      const digits = code.replace(/\D/g, "")
      return digits.length >= 8 && !/0{8,}$/.test(digits)
    })

  if (matches.length === 0) {
    const generic = text.match(new RegExp(`(${prefix}\\d{6,11})`))
    return generic ? padAccountCode12(generic[1]!) : padAccountCode12(fallback)
  }

  matches.sort((left, right) => {
    const leftZeros = (left.match(/0/g) ?? []).length
    const rightZeros = (right.match(/0/g) ?? []).length
    return leftZeros - rightZeros || right.length - left.length
  })

  return padAccountCode12(matches[0]!)
}

export function parseTpPredefiAssetDefaults(buffer: ImportBytes): A3FixedAssetDefaults {
  const text = decodeLatin1(buffer)
  return {
    cuentaInmovilizado: pickBestAccount(text, "21", DEFAULT_ASSET_ACCOUNTS.cuentaInmovilizado),
    cuentaAmortAcumulada: pickBestAccount(text, "281", DEFAULT_ASSET_ACCOUNTS.cuentaAmortAcumulada),
    cuentaGastoAmort: pickBestAccount(text, "681", DEFAULT_ASSET_ACCOUNTS.cuentaGastoAmort),
  }
}

export interface ParseAamDatOptions {
  fiscalYear?: number | null
  defaults?: A3FixedAssetDefaults
}

export function parseAamDatFixedAssets(
  buffer: ImportBytes,
  options: ParseAamDatOptions = {},
): A3FixedAsset[] {
  if (buffer.length <= AAM_HEADER_SIZE + AAM_RECORD_SIZE) return []

  const defaults = options.defaults ?? DEFAULT_ASSET_ACCOUNTS
  const fiscalYear = options.fiscalYear ?? new Date().getFullYear()
  const m1Records = collectM1Records(buffer)

  if (m1Records.length === 0) return []

  const nameByCode = buildNameByAssetCode(buffer)
  const assets: A3FixedAsset[] = []

  for (let chunkIndex = 0; chunkIndex < m1Records.length; chunkIndex += AAM_ASSET_CHUNK_SIZE) {
    const chunk = m1Records.slice(chunkIndex, chunkIndex + AAM_ASSET_CHUNK_SIZE)
    if (chunk.length < AAM_ASSET_CHUNK_SIZE) break

    const code = formatAssetCode(chunkIndex / AAM_ASSET_CHUNK_SIZE + 1)
    const elementType = String.fromCharCode(chunk[0]![11] ?? 0x30)
    const costs: number[] = []
    const accumulatedValues: number[] = []

    for (const record of chunk) {
      costs.push(centsToAmount(readUInt32LE(record, 24)))
      accumulatedValues.push(centsToAmount(readUInt32LE(record, 36)))
    }

    const acquisitionCost = Math.max(...costs.filter((value) => value > 0), 0)
    if (acquisitionCost <= 0) continue

    const accumulatedAmort = Math.max(...accumulatedValues.filter((value) => value > 0), 0)
    const periodAmort = averagePeriodAmort(buffer, code, acquisitionCost)
    const usefulLifeMonths = inferUsefulLifeMonths(acquisitionCost, accumulatedAmort, periodAmort)
    const name = nameByCode.get(code) ?? `Activo ${Number.parseInt(code, 10)}`

    assets.push({
      code,
      name,
      elementType,
      cuentaInmovilizado: defaults.cuentaInmovilizado,
      cuentaAmortAcumulada: defaults.cuentaAmortAcumulada,
      cuentaGastoAmort: defaults.cuentaGastoAmort,
      acquisitionDate: `${fiscalYear}-01-01`,
      acquisitionCost,
      residualValue: 0,
      usefulLifeMonths,
      accumulatedAmort: Math.min(accumulatedAmort, acquisitionCost),
      isActive: true,
    })
  }

  return assets
}

export function isAamDatBuffer(buffer: ImportBytes): boolean {
  return decodeLatin1(buffer.slice(0, 2)) === "0~"
}
