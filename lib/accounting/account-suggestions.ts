import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { searchPgcAccounts, type PgcAccount } from "@/lib/accounting/pgc-accounts"
import type { LedgerSubaccountOption } from "@/lib/accounting/ledger-subaccount-types"
import {
  getNewAccountPrefixHint,
  parseNewAccountPrefix,
  resolveAccountParentCode,
  type NewAccountPrefix,
} from "@/lib/accounting/new-account-prefix"

export interface ThirdPartyAccountOption {
  id: string
  type: "CLIENTE" | "PROVEEDOR"
  cif: string
  name: string
  accountCode: string
}

export interface AccountSuggestion {
  id: string
  code: string
  label: string
  subtitle?: string
  source: "pgc" | "tercero" | "ledger" | "create"
  createPrefix?: NewAccountPrefix
}

function thirdPartyToSuggestion(party: ThirdPartyAccountOption): AccountSuggestion {
  return {
    id: `tp-${party.id}`,
    code: party.accountCode,
    label: formatAccountCodeDisplay(party.accountCode),
    subtitle: `${party.name}${party.cif ? ` · ${party.cif}` : ""}`,
    source: "tercero",
  }
}

function ledgerToSuggestion(account: LedgerSubaccountOption): AccountSuggestion {
  return {
    id: `ledger-${account.id}`,
    code: account.accountCode,
    label: account.formattedAccountCode,
    subtitle: account.name,
    source: "ledger",
  }
}

function pgcToSuggestion(account: PgcAccount): AccountSuggestion {
  return {
    id: `pgc-${account.code}`,
    code: account.code,
    label: account.code,
    subtitle: account.name,
    source: "pgc",
  }
}

function collectCreatePrefixes(query: string): NewAccountPrefix[] {
  const exactPrefix = parseNewAccountPrefix(query)
  if (exactPrefix) return [exactPrefix]

  const normalized = query.trim().replace(/\./g, "")
  if (!normalized || normalized.endsWith("+")) return []

  const prefixes = new Set<NewAccountPrefix>()
  const direct = resolveAccountParentCode(normalized)
  if (direct) prefixes.add(direct.code)

  for (const account of searchPgcAccounts(normalized, 12)) {
    if (account.code.startsWith(normalized)) {
      prefixes.add(account.code)
    }
  }

  return Array.from(prefixes)
}

function createAccountSuggestions(query: string): AccountSuggestion[] {
  return collectCreatePrefixes(query).map((prefix) => {
    const meta = resolveAccountParentCode(prefix)
    return {
      id: `create-${prefix}`,
      code: `${prefix}+`,
      label: `${prefix}+`,
      subtitle: meta
        ? `${meta.label} · ${parseNewAccountPrefix(query) ? "Pulsa Enter" : "Crear subcuenta"}`
        : getNewAccountPrefixHint(prefix),
      source: "create",
      createPrefix: prefix,
    }
  })
}

export function searchAccountSuggestions(
  query: string,
  thirdParties: ThirdPartyAccountOption[],
  ledgerSubaccounts: LedgerSubaccountOption[],
  options?: { preferPrefix?: string; limit?: number },
): AccountSuggestion[] {
  const limit = options?.limit ?? 12
  const normalized = query.trim().toLowerCase().replace(/\./g, "")
  const preferPrefix = options?.preferPrefix?.replace(/\./g, "")

  const createMatches = createAccountSuggestions(query)

  const thirdPartyMatches = thirdParties
    .filter((party) => {
      if (!normalized || normalized.endsWith("+")) {
        return preferPrefix ? party.accountCode.startsWith(preferPrefix) : true
      }
      return (
        party.accountCode.includes(normalized) ||
        party.name.toLowerCase().includes(normalized) ||
        party.cif.toLowerCase().includes(normalized)
      )
    })
    .slice(0, limit)
    .map(thirdPartyToSuggestion)

  const ledgerMatches = ledgerSubaccounts
    .filter((account) => {
      if (!normalized || normalized.endsWith("+")) {
        return preferPrefix ? account.accountCode.startsWith(preferPrefix) : true
      }
      return (
        account.accountCode.includes(normalized) ||
        account.name.toLowerCase().includes(normalized) ||
        account.parentCode.includes(normalized)
      )
    })
    .slice(0, limit)
    .map(ledgerToSuggestion)

  const pgcMatches =
    parseNewAccountPrefix(query) || normalized.endsWith("+")
      ? []
      : searchPgcAccounts(normalized || preferPrefix || "", limit).map(pgcToSuggestion)

  const merged = [...createMatches, ...thirdPartyMatches, ...ledgerMatches, ...pgcMatches]
  const seen = new Set<string>()

  return merged
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .slice(0, limit)
}

export function inferThirdPartyPrefix(cuenta: string): "430" | "400" | "410" | null {
  const digits = cuenta.replace(/\D/g, "")
  if (digits.startsWith("430")) return "430"
  if (digits.startsWith("400")) return "400"
  if (digits.startsWith("410")) return "410"
  return null
}

export function inferThirdPartyTypeFromAccount(cuenta: string): "CLIENTE" | "PROVEEDOR" {
  return inferThirdPartyPrefix(cuenta) === "430" ? "CLIENTE" : "PROVEEDOR"
}

export function isEmitidaThirdPartyAccount(cuenta: string): boolean {
  return cuenta.replace(/\D/g, "").startsWith("430")
}
