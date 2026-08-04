import type { ImportBytes } from "@/lib/imports/a3/import-bytes"
import { padAccountCode12 } from "@/lib/imports/a3/native-account-code"

export const TCLIPRO_RECORD_SIZE = 536

/** Detecta inicio de registro TCLIPRO (cabecera 10040000 / 41000000). */
export function isTcliproRecordStart(buffer: ImportBytes, offset: number): boolean {
  return buffer[offset + 4] === 0x10 && buffer[offset + 5] === 0x04
}

export function findTcliproRecordStarts(buffer: ImportBytes): number[] {
  const starts: number[] = []
  for (let offset = 0; offset + 8 < buffer.length; offset += 1) {
    if (isTcliproRecordStart(buffer, offset)) {
      starts.push(offset)
    }
  }
  return starts
}

/**
 * Cuenta contable embebida en el registro TCLIPRO (bytes 16–17).
 * - Grupo 410: byte17−61 → 41000XXX (acreedores servicios; byte17 ≥ 61).
 * - Grupo 400: byte16=0 y byte17<61 → 400000XX (proveedores mercaderías).
 */
export function decodeTcliproRecordAccount(record: ImportBytes): string | null {
  if (record.length < 18) return null

  const byte16 = record[16]!
  const byte17 = record[17]!

  if (byte17 >= 61) {
    const subaccount = byte17 - 61
    if (subaccount > 0 && subaccount <= 9999) {
      return padAccountCode12(`4100${String(subaccount).padStart(4, "0")}`)
    }
  }

  if (byte16 === 0 && byte17 > 0 && byte17 < 61) {
    return padAccountCode12(String(40000000 + byte17))
  }

  return null
}

/** Elige el registro duplicado más fiable (A3 emite pares byte17 / byte17+1). */
export function pickPreferredTcliproRecord(records: ImportBytes[]): ImportBytes | null {
  if (records.length === 0) return null
  if (records.length === 1) return records[0]!

  const withByte17 = records.map((record) => ({ record, byte17: record[17] ?? 0 }))
  const serviceRecords = withByte17.filter(({ byte17 }) => byte17 >= 61)
  if (serviceRecords.length > 0) {
    serviceRecords.sort((a, b) => a.byte17 - b.byte17)
    return serviceRecords[0]!.record
  }

  const merchandiseRecords = withByte17.filter(({ byte17 }) => byte17 > 0 && byte17 < 61)
  if (merchandiseRecords.length > 0) {
    merchandiseRecords.sort((a, b) => b.byte17 - a.byte17)
    return merchandiseRecords[0]!.record
  }

  return records[0]!
}
