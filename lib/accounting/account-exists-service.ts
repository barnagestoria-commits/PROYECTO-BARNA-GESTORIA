import { prisma } from "@/lib/db"
import { PGC_ACCOUNTS } from "@/lib/accounting/pgc-accounts"
import {
  parseDottedAccountShortcut,
  resolveAccountShortcut,
  toShortcutCandidates,
} from "@/lib/accounting/account-shortcut"
import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import {
  isThirdPartyAccountPrefix,
  resolveAccountParentCode,
} from "@/lib/accounting/new-account-prefix"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { normalizeCuenta } from "@/lib/reports/format"
import {
  canonicalAccountDigits,
  inferParentCodeFromAccount,
  isExactPgcAccount,
} from "@/lib/accounting/canonical-account-code"

export {
  canonicalAccountDigits,
  expandCanonicalSubaccountCode,
  inferParentCodeFromAccount,
} from "@/lib/accounting/canonical-account-code"

export interface AccountExistenceResult {
  exists: boolean
  accountCode: string
  formattedAccountCode: string
  parentCode: string | null
  isThirdParty: boolean
  canQuickCreate: boolean
  label: string | null
}

function requiresSubaccountRegistration(digits: string): boolean {
  if (isExactPgcAccount(digits)) return false
  const parent = inferParentCodeFromAccount(digits)
  if (!parent) return digits.length > 3
  return digits.length > parent.length
}

/** La cuenta genérica del PGC (572, 572.0000) ya existe; solo piden alta las subcuentas nuevas. */
export function accountNeedsRegistration(rawCode: string): boolean {
  const digits = canonicalAccountDigits(rawCode)
  if (!digits || digits.length < 2) return false
  return requiresSubaccountRegistration(digits)
}

export async function countMissingImportSubaccounts(
  companyId: string,
  rawCodes: string[],
): Promise<number> {
  const codes = [
    ...new Set(rawCodes.map((code) => canonicalAccountDigits(code)).filter((code) => code.length >= 2)),
  ]
  if (codes.length === 0) return 0

  const lookupCodes = [...new Set(codes.flatMap((code) => accountCodeLookupVariants(code)))]

  const [ledgerRows, thirdPartyRows] = await Promise.all([
    prisma.ledgerSubaccount.findMany({
      where: { companyId, accountCode: { in: lookupCodes } },
      select: { accountCode: true },
    }),
    prisma.thirdParty.findMany({
      where: { companyId, accountCode: { in: lookupCodes } },
      select: { accountCode: true },
    }),
  ])

  const existing = new Set(
    [...ledgerRows, ...thirdPartyRows].flatMap((row) => accountCodeLookupVariants(row.accountCode)),
  )

  let missing = 0
  for (const digits of codes) {
    if (existing.has(digits)) continue
    if (!accountNeedsRegistration(digits)) continue
    const parentCode = inferParentCodeFromAccount(digits)
    const parentMeta = parentCode ? resolveAccountParentCode(parentCode) : null
    if (parentMeta) missing += 1
  }

  return missing
}

async function resolveShortcutFromCompany(
  companyId: string,
  rawCode: string,
): Promise<AccountExistenceResult | null> {
  if (!parseDottedAccountShortcut(rawCode)) return null

  const [thirdParties, subaccounts] = await Promise.all([
    prisma.thirdParty.findMany({
      where: { companyId },
      select: { accountCode: true, name: true, cif: true },
    }),
    prisma.ledgerSubaccount.findMany({
      where: { companyId },
      select: { accountCode: true, name: true, parentCode: true },
    }),
  ])

  const resolved = resolveAccountShortcut(
    rawCode,
    toShortcutCandidates(thirdParties, subaccounts),
  )
  if (!resolved) return null

  return {
    exists: true,
    accountCode: resolved.accountCode,
    formattedAccountCode: resolved.formattedAccountCode,
    parentCode: inferParentCodeFromAccount(resolved.accountCode),
    isThirdParty: resolved.source === "tercero" || isThirdPartyAccountPrefix(resolved.accountCode),
    canQuickCreate: false,
    label: resolved.name,
  }
}

export async function checkAccountExists(
  companyId: string,
  rawCode: string,
): Promise<AccountExistenceResult> {
  const shortcut = await resolveShortcutFromCompany(companyId, rawCode)
  if (shortcut) return shortcut

  const rawDigits = normalizeCuenta(rawCode)
  const digits = canonicalAccountDigits(rawCode) || rawDigits
  const lookupCodes = accountCodeLookupVariants(rawCode)
  const formattedAccountCode = formatAccountCodeDisplay(digits)

  if (!digits || digits.length < 2) {
    return {
      exists: true,
      accountCode: digits,
      formattedAccountCode,
      parentCode: null,
      isThirdParty: false,
      canQuickCreate: false,
      label: null,
    }
  }

  const [thirdParties, ledgers] = await Promise.all([
    prisma.thirdParty.findMany({
      where: { companyId, accountCode: { in: lookupCodes } },
      select: { name: true, accountCode: true },
    }),
    prisma.ledgerSubaccount.findMany({
      where: { companyId, accountCode: { in: lookupCodes } },
      select: { name: true, accountCode: true, parentCode: true },
    }),
  ])
  const thirdParty =
    thirdParties.find((row) => row.accountCode === digits) ?? thirdParties[0] ?? null
  const ledger = ledgers.find((row) => row.accountCode === digits) ?? ledgers[0] ?? null

  if (thirdParty) {
    return {
      exists: true,
      accountCode: thirdParty.accountCode,
      formattedAccountCode: formatAccountCodeDisplay(thirdParty.accountCode),
      parentCode: inferParentCodeFromAccount(thirdParty.accountCode),
      isThirdParty: true,
      canQuickCreate: false,
      label: thirdParty.name,
    }
  }

  if (ledger) {
    return {
      exists: true,
      accountCode: ledger.accountCode,
      formattedAccountCode: formatAccountCodeDisplay(ledger.accountCode),
      parentCode: ledger.parentCode,
      isThirdParty: false,
      canQuickCreate: false,
      label: ledger.name,
    }
  }

  if (isExactPgcAccount(digits)) {
    const pgc = PGC_ACCOUNTS.find((account) => account.code === digits)!
    return {
      exists: true,
      accountCode: digits,
      formattedAccountCode,
      parentCode: digits,
      isThirdParty: isThirdPartyAccountPrefix(digits),
      canQuickCreate: false,
      label: pgc.name,
    }
  }

  if (!requiresSubaccountRegistration(digits)) {
    return {
      exists: true,
      accountCode: digits,
      formattedAccountCode,
      parentCode: inferParentCodeFromAccount(digits),
      isThirdParty: isThirdPartyAccountPrefix(digits),
      canQuickCreate: false,
      label: null,
    }
  }

  const parentCode = inferParentCodeFromAccount(digits)
  const parentMeta = parentCode ? resolveAccountParentCode(parentCode) : null
  const isThirdParty = parentMeta?.isThirdParty ?? isThirdPartyAccountPrefix(digits)

  return {
    exists: false,
    accountCode: digits,
    formattedAccountCode,
    parentCode,
    isThirdParty,
    canQuickCreate: Boolean(parentMeta),
    label: parentMeta?.label ?? null,
  }
}
