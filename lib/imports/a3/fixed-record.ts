/** Utilidades para registros fijos de 512 bytes del enlace contable A3 (v9.50+). */

export const A3_RECORD_LENGTH = 512

import { decodeLatin1, type ImportBytes } from "@/lib/imports/a3/import-bytes"

export { decodeLatin1 }

export function sliceField(record: string, start: number, length: number): string {
  // Posiciones del manual A3 son 1-indexed.
  return record.slice(start - 1, start - 1 + length).trim()
}

export function parseA3Amount(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0

  const sign = trimmed.startsWith("-") ? -1 : 1
  const digits = trimmed.replace(/[^\d.,]/g, "")
  if (!digits) return 0

  const normalized = digits.includes(".")
    ? digits.replace(/,/g, "")
    : digits.replace(/\./g, "").replace(",", ".")

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * sign * 100) / 100
}

export function normalizeAccountCode(raw: string): string {
  return raw.replace(/\D/g, "").trim()
}

export function formatA3Date(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length !== 8) return null
  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return null
  }
  return `${year}-${month}-${day}`
}

export function splitFixedRecords(buffer: ImportBytes): string[] {
  const text = decodeLatin1(buffer)
  const records: string[] = []

  if (buffer.length >= A3_RECORD_LENGTH && buffer.length % A3_RECORD_LENGTH <= 2) {
    for (let offset = 0; offset + A3_RECORD_LENGTH <= buffer.length; offset += A3_RECORD_LENGTH) {
      records.push(text.slice(offset, offset + A3_RECORD_LENGTH))
    }
    if (records.length > 0) return records
  }

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (line.length >= A3_RECORD_LENGTH - 2) {
      records.push(line.slice(0, A3_RECORD_LENGTH))
    }
  }
  return records
}

export function isSuenlaceRecord(record: string): boolean {
  return sliceField(record, 1, 1) === "5"
}
