import type { ImportBytes } from "@/lib/imports/a3/import-bytes"
import { padAccountCode12 } from "@/lib/imports/a3/native-account-code"

/** Partidas pendientes de aplicación (A3: 55500000). */
export const NATIVE_PENDING_ACCOUNT = "555000000000"

/** Primas de seguros (A3: 62500000). */
export const NATIVE_INSURANCE_ACCOUNT = "625000000000"

/**
 * Marca binaria en adeudos A3: bytes 27–28 = 0x23 0x29 → cuenta 625 (seguros).
 * Resto de adeudos/domiciliaciones sin proveedor → 555 (pendientes).
 */
function recordHasInsuranceDirectDebitMarker(record: ImportBytes): boolean {
  for (let offset = 0; offset + 1 < record.length; offset += 1) {
    if (record[offset] === 0x23 && record[offset + 1] === 0x29) return true
  }
  return false
}

export function decodeDirectDebitAccountFromRecord(record: ImportBytes): string {
  if (recordHasInsuranceDirectDebitMarker(record)) {
    return padAccountCode12(NATIVE_INSURANCE_ACCOUNT)
  }
  return padAccountCode12(NATIVE_PENDING_ACCOUNT)
}

export function isDirectDebitConcept(concept: string): boolean {
  const upper = concept.toUpperCase()
  return upper.includes("ADEUDO") || upper.includes("DOMICILIACI")
}

export function isUnidentifiedBankPaymentConcept(concept: string): boolean {
  const upper = concept.toUpperCase()
  return (
    isDirectDebitConcept(concept) ||
    upper.includes("PAGO FRA") ||
    upper.includes("TRANSFERENCIA") ||
    upper.includes("RECIBO") ||
    upper.includes("TARJETA") ||
    upper.includes("TRASPASO")
  )
}

export function resolveUnidentifiedBankMovementAccount(
  concept: string,
  record: ImportBytes | null,
): string {
  if (isDirectDebitConcept(concept) && record) {
    return decodeDirectDebitAccountFromRecord(record)
  }
  return padAccountCode12(NATIVE_PENDING_ACCOUNT)
}
