import type { ThirdPartyType } from "@prisma/client"

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
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, "")
}

export function formatAccountCodeDisplay(accountCode: string): string {
  const digits = accountCode.replace(/\D/g, "")
  if (digits.length <= 3) return digits
  return `${digits.slice(0, 3)}.${digits.slice(3)}`
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
