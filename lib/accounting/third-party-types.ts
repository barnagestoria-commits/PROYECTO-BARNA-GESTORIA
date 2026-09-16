import type { ThirdPartyType } from "@prisma/client"
import { normalizeTaxId } from "@/lib/tax-id"

export const THIRD_PARTY_PREFIX: Record<ThirdPartyType, string> = {
  PROVEEDOR: "400",
  CLIENTE: "430",
}

export const THIRD_PARTY_LABEL: Record<ThirdPartyType, string> = {
  PROVEEDOR: "Proveedor",
  CLIENTE: "Cliente",
}

export interface ThirdPartyResolution {
  type: ThirdPartyType
  cif: string
  name: string
  accountCode: string
  formattedAccountCode: string
  isNew: boolean
  thirdPartyId: string | null
}

export function normalizeCif(value: string): string {
  return normalizeTaxId(value)
}

/** Persistible: 400 se guarda como 400, 4100001 como 410.0001. */
export function formatAccountCodeStored(accountCode: string): string {
  const rawDigits = accountCode.replace(/\D/g, "")
  if (!rawDigits) return ""
  const digits =
    rawDigits.length === 7 && rawDigits.endsWith("0000")
      ? rawDigits.slice(0, 3)
      : rawDigits.length === 8 && rawDigits.endsWith("0000")
        ? rawDigits.slice(0, 4)
        : rawDigits
  if (digits.length <= 4) return digits
  return `${digits.slice(0, 3)}.${digits.slice(3)}`
}

/** Visual PGC: 400 → 400.0000, 4751 → 4751.0000, 4100001 → 410.0001. */
export function formatAccountCodeDisplay(accountCode: string): string {
  const digits = accountCode.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length <= 4) return `${digits}.0000`
  const suffix = digits.slice(3).padEnd(4, "0")
  return `${digits.slice(0, 3)}.${suffix}`
}

export function parseSubaccountSequence(accountCode: string, prefix: string): number | null {
  const digits = accountCode.replace(/\D/g, "")
  if (!digits.startsWith(prefix)) return null

  const suffix = digits.slice(prefix.length)
  if (!suffix) return null

  const sequence = Number.parseInt(suffix, 10)
  return Number.isFinite(sequence) ? sequence : null
}

export function buildAccountCode(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(4, "0")}`
}

export function thirdPartyTypeFromDocumentType(
  documentType: "factura-recibida" | "factura-emitida",
): ThirdPartyType {
  return documentType === "factura-emitida" ? "CLIENTE" : "PROVEEDOR"
}
