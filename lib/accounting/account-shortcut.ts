import { buildAccountCode, formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

export interface AccountShortcutCandidate {
  accountCode: string
  name: string
  cif?: string
  source: "tercero" | "ledger"
}

export interface ResolvedAccountShortcut {
  accountCode: string
  formattedAccountCode: string
  name: string
  cif?: string
  source: "tercero" | "ledger"
}

export interface UnresolvedDottedShortcut {
  group: string
  sequence: number
  fallbackAccountCode: string
  formattedAccountCode: string
  parentCode: string
}

const PREFERRED_GROUP_PREFIX: Record<string, string> = {
  "40": "400",
  "41": "410",
  "43": "430",
}

const THIRD_PARTY_SHORTCUT_GROUPS = new Set(["40", "41", "43", "400", "410", "430"])

export function parseDottedAccountShortcut(
  raw: string,
): { group: string; sequence: number } | null {
  const match = raw.trim().match(/^(\d{2,4})\.(\d{1,8})$/)
  if (!match) return null
  const sequence = Number.parseInt(match[2], 10)
  if (!Number.isFinite(sequence) || sequence < 1) return null
  return { group: match[1], sequence }
}

export function isThirdPartyDottedShortcut(raw: string): boolean {
  const parsed = parseDottedAccountShortcut(raw)
  return Boolean(parsed && THIRD_PARTY_SHORTCUT_GROUPS.has(parsed.group))
}

export function preferredParentForShortcutGroup(group: string): string {
  if (PREFERRED_GROUP_PREFIX[group]) return PREFERRED_GROUP_PREFIX[group]
  if (group.length >= 3) return group
  return `${group}0`
}

function digitsOf(accountCode: string): string {
  return accountCode.replace(/\D/g, "")
}

function sequenceAfterGroup(accountCode: string, group: string): number | null {
  const digits = digitsOf(accountCode)
  if (!digits.startsWith(group)) return null

  const parentLength = group.length <= 2 ? 3 : group.length
  if (digits.length <= parentLength) return null

  const suffix = digits.slice(parentLength)
  if (!suffix) return null
  const sequence = Number.parseInt(suffix, 10)
  return Number.isFinite(sequence) ? sequence : null
}

function toResolved(candidate: AccountShortcutCandidate): ResolvedAccountShortcut {
  const accountCode = digitsOf(candidate.accountCode)
  return {
    accountCode,
    formattedAccountCode: formatAccountCodeDisplay(accountCode),
    name: candidate.name,
    cif: candidate.cif,
    source: candidate.source,
  }
}

function rankShortcutMatches(
  matches: AccountShortcutCandidate[],
  preferredPrefix: string,
): AccountShortcutCandidate {
  return [...matches].sort((left, right) => {
    const leftDigits = digitsOf(left.accountCode)
    const rightDigits = digitsOf(right.accountCode)
    const leftPreferred = leftDigits.startsWith(preferredPrefix) ? 1 : 0
    const rightPreferred = rightDigits.startsWith(preferredPrefix) ? 1 : 0
    if (rightPreferred !== leftPreferred) return rightPreferred - leftPreferred

    const leftTercero = left.source === "tercero" ? 1 : 0
    const rightTercero = right.source === "tercero" ? 1 : 0
    if (rightTercero !== leftTercero) return rightTercero - leftTercero

    const leftNamed = left.name.trim() ? 1 : 0
    const rightNamed = right.name.trim() ? 1 : 0
    if (rightNamed !== leftNamed) return rightNamed - leftNamed

    return rightDigits.length - leftDigits.length
  })[0]!
}

export function unresolvedDottedShortcut(
  parsed: { group: string; sequence: number },
): UnresolvedDottedShortcut {
  const parentCode = preferredParentForShortcutGroup(parsed.group)
  const fallbackAccountCode = buildAccountCode(parentCode, parsed.sequence)
  return {
    group: parsed.group,
    sequence: parsed.sequence,
    fallbackAccountCode,
    formattedAccountCode: formatAccountCodeDisplay(fallbackAccountCode),
    parentCode,
  }
}

export function resolveAccountShortcut(
  raw: string,
  candidates: AccountShortcutCandidate[],
): ResolvedAccountShortcut | null {
  const parsed = parseDottedAccountShortcut(raw)
  if (!parsed) return null

  const preferredPrefix = preferredParentForShortcutGroup(parsed.group)
  const matches = candidates.filter(
    (item) => sequenceAfterGroup(item.accountCode, parsed.group) === parsed.sequence,
  )
  if (matches.length > 0) {
    return toResolved(rankShortcutMatches(matches, preferredPrefix))
  }

  const nativeCode = buildAccountCode(preferredPrefix, parsed.sequence)
  const exact = candidates.find((item) => digitsOf(item.accountCode) === nativeCode)
  return exact ? toResolved(exact) : null
}

export function toShortcutCandidates(
  thirdParties: Array<{ accountCode: string; name: string; cif?: string }>,
  ledgerSubaccounts: Array<{ accountCode: string; name: string }>,
): AccountShortcutCandidate[] {
  return [
    ...thirdParties.map((party) => ({
      accountCode: party.accountCode,
      name: party.name,
      cif: party.cif,
      source: "tercero" as const,
    })),
    ...ledgerSubaccounts.map((account) => ({
      accountCode: account.accountCode,
      name: account.name,
      source: "ledger" as const,
    })),
  ]
}
