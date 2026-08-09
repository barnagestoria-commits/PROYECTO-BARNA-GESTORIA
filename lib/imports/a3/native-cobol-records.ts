import { toUint8Array, type ImportBytes } from "@/lib/imports/a3/import-bytes"

export const NATIVE_COBOL_HEADER_SIZE = 128
export const NATIVE_COBOL_MAGIC = 0x30
export const NATIVE_COBOL_MAGIC2 = 0x7e

export type CobolRecordStatus = "active" | "deleted" | "unknown"

export interface CobolRecordSlice {
  offset: number
  length: number
  status: CobolRecordStatus
  payload: Uint8Array
}

export interface CobolRecordCounts {
  active: number
  deleted: number
  unknown: number
  total: number
}

export function isNativeCobolFile(buffer: ImportBytes): boolean {
  const data = toUint8Array(buffer)
  return data.length >= 2 && data[0] === NATIVE_COBOL_MAGIC && data[1] === NATIVE_COBOL_MAGIC2
}

export function nativeCobolDataStart(buffer: ImportBytes): number {
  return isNativeCobolFile(buffer) ? NATIVE_COBOL_HEADER_SIZE : 0
}

export function cobolRecordStatusByte(byte0: number): CobolRecordStatus {
  const estado = byte0 & 0xf0
  if (estado === 0x40 || estado === 0x41 || estado === 0x42) return "active"
  if (estado === 0x20 || estado === 0x21 || estado === 0x22) return "deleted"
  return "unknown"
}

export function isActiveCobolStatus(byte0: number): boolean {
  return cobolRecordStatusByte(byte0) === "active"
}

export function isDeletedCobolStatus(byte0: number): boolean {
  return cobolRecordStatusByte(byte0) === "deleted"
}

export function cobolRecordLength(buffer: ImportBytes, offset: number): number | null {
  const data = toUint8Array(buffer)
  if (offset + 2 > data.length) return null
  const byte0 = data[offset]!
  const byte1 = data[offset + 1]!
  const length = ((byte0 & 0x0f) << 8) | byte1
  if (length < 2) return null
  return length
}

export function walkNativeCobolRecords(
  buffer: ImportBytes,
  options?: { includeDeleted?: boolean; includeUnknown?: boolean },
): CobolRecordSlice[] {
  const data = toUint8Array(buffer)
  let offset = nativeCobolDataStart(data)
  const records: CobolRecordSlice[] = []

  while (offset + 2 <= data.length) {
    const length = cobolRecordLength(data, offset)
    if (!length || offset + length > data.length) break

    const status = cobolRecordStatusByte(data[offset]!)
    const include =
      status === "active" ||
      (options?.includeDeleted && status === "deleted") ||
      (options?.includeUnknown && status === "unknown")

    if (include) {
      records.push({
        offset,
        length,
        status,
        payload: data.subarray(offset, offset + length),
      })
    }

    offset += length
  }

  return records
}

export function countNativeCobolRecords(buffer: ImportBytes): CobolRecordCounts {
  const all = walkNativeCobolRecords(buffer, { includeDeleted: true, includeUnknown: true })
  const counts: CobolRecordCounts = { active: 0, deleted: 0, unknown: 0, total: 0 }

  for (const record of all) {
    counts.total += 1
    if (record.status === "active") counts.active += 1
    else if (record.status === "deleted") counts.deleted += 1
    else counts.unknown += 1
  }

  return counts
}

export function countFixedBlockRecords(
  buffer: ImportBytes,
  blockSize: number,
  dataStart = 0,
): CobolRecordCounts {
  const data = toUint8Array(buffer)
  const counts: CobolRecordCounts = { active: 0, deleted: 0, unknown: 0, total: 0 }

  for (let offset = dataStart; offset + blockSize <= data.length; offset += blockSize) {
    counts.total += 1
    const status = cobolRecordStatusByte(data[offset]!)
    if (status === "active") counts.active += 1
    else if (status === "deleted") counts.deleted += 1
    else counts.unknown += 1
  }

  return counts
}
