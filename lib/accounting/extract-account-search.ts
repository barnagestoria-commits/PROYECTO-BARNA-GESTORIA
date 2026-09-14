import { accountMatchesDottedShortcut, parseDottedAccountShortcut } from "@/lib/accounting/account-shortcut"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeCuenta } from "@/lib/reports/format"

function foldSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

export function extractAccountMatchesSearch(
  row: { cuenta: string; label: string },
  query: string,
): boolean {
  const raw = query.trim()
  if (!raw) return true

  const needle = foldSearchText(raw)
  if (needle && foldSearchText(row.label).includes(needle)) return true

  if (parseDottedAccountShortcut(raw)) {
    return accountMatchesDottedShortcut(row.cuenta, raw)
  }

  const display = formatAccountCodeDisplay(row.cuenta)
  const foldedDisplay = foldSearchText(display)
  if (foldedDisplay.includes(needle) || foldedDisplay.replace(/\./g, "").includes(needle.replace(/\./g, ""))) {
    return true
  }

  const queryDigits = normalizeCuenta(raw)
  if (!queryDigits) return false
  const stored = normalizeCuenta(row.cuenta)
  return stored === queryDigits || stored.startsWith(queryDigits)
}