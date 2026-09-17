import { PGC_ACCOUNTS } from "@/lib/accounting/pgc-accounts"
import {
  parseDottedAccountShortcut,
  unresolvedDottedShortcut,
} from "@/lib/accounting/account-shortcut"
import {
  buildAccountCode,
  formatAccountCodeDisplay,
  formatAccountCodeStored,
} from "@/lib/accounting/third-party-types"
import { normalizeCuenta } from "@/lib/reports/format"

export function inferParentCodeFromAccount(digits: string): string | null {
  const sorted = [...PGC_ACCOUNTS].sort((a, b) => b.code.length - a.code.length)
  for (const account of sorted) {
    if (digits.startsWith(account.code) && digits.length > account.code.length) {
      return account.code
    }
  }
  return null
}

export function isExactPgcAccount(digits: string): boolean {
  return PGC_ACCOUNTS.some((account) => account.code === digits)
}

/** Convierte 628.1 / 6281 en la subcuenta canónica 6280001 (628.0001). */
export function expandCanonicalSubaccountCode(raw: string): string {
  const dotted = parseDottedAccountShortcut(raw)
  if (dotted) return unresolvedDottedShortcut(dotted).fallbackAccountCode

  const digits = normalizeCuenta(raw)
  if (!digits || isExactPgcAccount(digits)) return digits

  const parent = inferParentCodeFromAccount(digits)
  if (!parent) return digits

  const suffix = digits.slice(parent.length)
  if (!suffix || suffix.length >= 4) return digits

  const sequence = Number.parseInt(suffix, 10)
  if (!Number.isFinite(sequence) || sequence < 1) return digits
  return buildAccountCode(parent, sequence)
}

/** 572.0000 / 5720000 → 572; 572.0001 sigue siendo subcuenta. */
export function canonicalAccountDigits(raw: string): string {
  const expanded = expandCanonicalSubaccountCode(raw) || normalizeCuenta(raw)
  return normalizeCuenta(formatAccountCodeStored(expanded)) || expanded
}

export function canonicalizeStoredAccountCode(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  return formatAccountCodeStored(expandCanonicalSubaccountCode(trimmed))
}

export function formatAccountCodeForUi(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  return formatAccountCodeDisplay(expandCanonicalSubaccountCode(trimmed))
}

export function needsCanonicalAccountRepair(stored: string): boolean {
  const trimmed = stored.trim()
  if (!trimmed) return false
  return trimmed !== canonicalizeStoredAccountCode(trimmed)
}
