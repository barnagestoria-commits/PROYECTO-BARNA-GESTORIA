import type { ThirdPartyType } from "@prisma/client"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { PGC_ACCOUNTS } from "@/lib/accounting/pgc-accounts"

export const THIRD_PARTY_ACCOUNT_PREFIXES = ["430", "400", "410"] as const

export type ThirdPartyAccountPrefix = (typeof THIRD_PARTY_ACCOUNT_PREFIXES)[number]

export const THIRD_PARTY_PREFIX_CONFIG: Record<
  ThirdPartyAccountPrefix,
  { label: string; description: string; thirdPartyType: ThirdPartyType }
> = {
  "430": {
    label: "Nuevo cliente",
    description: "Subcuenta de clientes (430) para facturas emitidas y cobros.",
    thirdPartyType: "CLIENTE",
  },
  "400": {
    label: "Nuevo proveedor",
    description: "Subcuenta de proveedores (400) para facturas recibidas y pagos.",
    thirdPartyType: "PROVEEDOR",
  },
  "410": {
    label: "Nuevo acreedor",
    description: "Subcuenta de acreedores (410) para prestaciones de servicios.",
    thirdPartyType: "PROVEEDOR",
  },
}

/** Prefijo de cuenta PGC válido para alta con + (430, 678, 629, 57, …) */
export type NewAccountPrefix = string

export interface AccountParentMeta {
  code: string
  label: string
  isThirdParty: boolean
}

export function resolveAccountParentCode(raw: string): AccountParentMeta | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 2 || digits.length > 4) return null

  const exact = PGC_ACCOUNTS.find((account) => account.code === digits)
  if (exact) {
    return {
      code: exact.code,
      label: exact.name,
      isThirdParty: isThirdPartyAccountPrefix(digits),
    }
  }

  const group2 = digits.slice(0, 2)
  const groupInPgc = PGC_ACCOUNTS.some((account) => account.code === group2)
  if (groupInPgc) {
    return {
      code: digits,
      label: getAccountLabel(digits),
      isThirdParty: isThirdPartyAccountPrefix(digits),
    }
  }

  const groupMatch = PGC_ACCOUNTS.find((account) => account.code.startsWith(digits))
  if (groupMatch) {
    return {
      code: digits,
      label: getAccountLabel(digits),
      isThirdParty: isThirdPartyAccountPrefix(digits),
    }
  }

  return null
}

export function parseNewAccountPrefix(value: string): NewAccountPrefix | null {
  const match = value.trim().match(/^(\d{2,4})\+$/)
  if (!match) return null
  const meta = resolveAccountParentCode(match[1])
  return meta?.code ?? null
}

export function getNewAccountPrefixHint(prefix: NewAccountPrefix): string {
  const meta = resolveAccountParentCode(prefix)
  if (!meta) return `${prefix}+`
  if (meta.isThirdParty) {
    return `${prefix}+ · ${THIRD_PARTY_PREFIX_CONFIG[prefix as ThirdPartyAccountPrefix].label}`
  }
  return `${prefix}+ · Nueva subcuenta de ${meta.label}`
}

export function isThirdPartyAccountPrefix(cuenta: string): boolean {
  const digits = cuenta.replace(/\D/g, "")
  return (
    digits.startsWith("430") ||
    digits.startsWith("400") ||
    digits.startsWith("410")
  )
}

export function isThirdPartyNewAccountPrefix(prefix: string): prefix is ThirdPartyAccountPrefix {
  return (THIRD_PARTY_ACCOUNT_PREFIXES as readonly string[]).includes(prefix)
}
