import { prisma } from "@/lib/db"
import { PGC_ACCOUNTS } from "@/lib/accounting/pgc-accounts"
import {
  isThirdPartyAccountPrefix,
  resolveAccountParentCode,
} from "@/lib/accounting/new-account-prefix"
import { normalizeCuenta } from "@/lib/reports/format"

export interface AccountExistenceResult {
  exists: boolean
  accountCode: string
  formattedAccountCode: string
  parentCode: string | null
  isThirdParty: boolean
  canQuickCreate: boolean
  label: string | null
}

function formatDisplay(code: string): string {
  const digits = code.replace(/\D/g, "")
  if (digits.length <= 3) return digits
  return `${digits.slice(0, 3)}.${digits.slice(3)}`
}

export function inferParentCodeFromAccount(digits: string): string | null {
  const sorted = [...PGC_ACCOUNTS].sort((a, b) => b.code.length - a.code.length)
  for (const account of sorted) {
    if (digits.startsWith(account.code) && digits.length > account.code.length) {
      return account.code
    }
  }
  return null
}

function isExactPgcAccount(digits: string): boolean {
  return PGC_ACCOUNTS.some((account) => account.code === digits)
}

function requiresSubaccountRegistration(digits: string): boolean {
  if (isExactPgcAccount(digits)) return false
  const parent = inferParentCodeFromAccount(digits)
  if (!parent) return digits.length > 3
  return digits.length > parent.length
}

export async function checkAccountExists(
  companyId: string,
  rawCode: string,
): Promise<AccountExistenceResult> {
  const digits = normalizeCuenta(rawCode)
  const formattedAccountCode = formatDisplay(digits)

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

  const [thirdParty, ledger] = await Promise.all([
    prisma.thirdParty.findFirst({
      where: { companyId, accountCode: digits },
      select: { name: true, accountCode: true },
    }),
    prisma.ledgerSubaccount.findFirst({
      where: { companyId, accountCode: digits },
      select: { name: true, accountCode: true, parentCode: true },
    }),
  ])

  if (thirdParty) {
    return {
      exists: true,
      accountCode: digits,
      formattedAccountCode,
      parentCode: inferParentCodeFromAccount(digits),
      isThirdParty: true,
      canQuickCreate: false,
      label: thirdParty.name,
    }
  }

  if (ledger) {
    return {
      exists: true,
      accountCode: digits,
      formattedAccountCode,
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
