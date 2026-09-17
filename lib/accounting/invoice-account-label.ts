import { canonicalAccountDigits } from "@/lib/accounting/canonical-account-code"
import {
  PURCHASE_EXPENSE_OPTIONS,
  SALES_INCOME_OPTIONS,
} from "@/lib/accounting/invoice-supplier-classification"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { getAccountLabel } from "@/lib/reports/pgc-labels"

export type InvoiceLedgerKind = "expense" | "income"

function stripCatalogCodePrefix(label: string): string {
  return label.replace(/^\d+(?:\.\d+)?\s*·\s*/, "").trim()
}

export function formatAccountCodeWithName(code: string, name?: string | null): string {
  const formatted =
    formatAccountCodeDisplay(canonicalAccountDigits(code) || code) || code.trim()
  const label = name?.trim() ?? ""
  if (!formatted) return label
  if (!label) return formatted
  if (label === formatted || label.startsWith(`${formatted} ·`)) return label
  return `${formatted} · ${label}`
}

export function catalogLedgerAccountName(
  code: string,
  kind: InvoiceLedgerKind,
): string | null {
  const digits = canonicalAccountDigits(code)
  if (!digits) return null

  const options = kind === "income" ? SALES_INCOME_OPTIONS : PURCHASE_EXPENSE_OPTIONS
  const match = options
    .filter((item) => digits === item.code || digits.startsWith(item.code))
    .sort((left, right) => right.code.length - left.code.length)[0]
  return match ? stripCatalogCodePrefix(match.label) : null
}

export function resolveInvoiceLedgerAccountName(
  code: string,
  kind: InvoiceLedgerKind,
  knownName?: string | null,
): string {
  if (knownName?.trim()) return knownName.trim()
  if (!code.trim()) return ""
  return catalogLedgerAccountName(code, kind) || getAccountLabel(code)
}

export function accountsShareCode(left: string, right: string): boolean {
  const leftDigits = canonicalAccountDigits(left)
  const rightDigits = canonicalAccountDigits(right)
  return Boolean(leftDigits) && leftDigits === rightDigits
}
