import {
  resolveAccountShortcut,
  toShortcutCandidates,
} from "@/lib/accounting/account-shortcut"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { formatAccountNameDisplay } from "@/lib/reports/format"
import { getAccountLabel } from "@/lib/reports/pgc-labels"

interface NamedAccount {
  accountCode: string
  name: string
  cif?: string
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Nombre visible de la cuenta de una línea.
 * Misma resolución para autónomos, gestoría y empresa: subcuenta propia, si no el PGC.
 */
export function describeEntryAccountLabel(
  cuenta: string,
  thirdParties: NamedAccount[],
  ledgerSubaccounts: NamedAccount[],
): string | null {
  const raw = cuenta.trim()
  if (!raw || raw.toUpperCase() === "EX" || raw.endsWith("+")) return null

  const candidates = toShortcutCandidates(thirdParties, ledgerSubaccounts)
  const shortcut = resolveAccountShortcut(raw, candidates)
  if (shortcut?.name.trim()) {
    return `${shortcut.formattedAccountCode} · ${formatAccountNameDisplay(shortcut.name)}`
  }

  const digits = digitsOf(raw)
  if (digits.length < 2) return null

  const exact = candidates.find((item) => digitsOf(item.accountCode) === digits)
  const name = exact?.name.trim()
    ? formatAccountNameDisplay(exact.name)
    : getAccountLabel(digits)
  const code = exact
    ? formatAccountCodeDisplay(exact.accountCode)
    : formatAccountCodeDisplay(digits)
  if (!code || !name) return null
  return `${code} · ${name}`
}

export function describeEntryAccountLabels(
  cuentas: string[],
  thirdParties: NamedAccount[],
  ledgerSubaccounts: NamedAccount[],
): string | null {
  const labels: string[] = []
  for (const cuenta of cuentas) {
    const label = describeEntryAccountLabel(cuenta, thirdParties, ledgerSubaccounts)
    if (label && !labels.includes(label)) labels.push(label)
  }
  return labels.length > 0 ? labels.join(" · ") : null
}
