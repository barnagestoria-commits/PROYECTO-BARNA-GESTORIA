import { prisma } from "@/lib/db"
import { inferParentCodeFromAccount } from "@/lib/accounting/account-exists-service"
import { resolveAccountParentCode } from "@/lib/accounting/new-account-prefix"
import {
  buildAccountCode,
  formatAccountCodeDisplay,
} from "@/lib/accounting/third-party-types"
import { findNextAccountSequenceForPrefix } from "@/lib/accounting/third-party-service"
import type { LedgerSubaccountResolution } from "@/lib/accounting/ledger-subaccount-types"

export async function previewLedgerSubaccount(
  companyId: string,
  parentCode: string,
  name: string,
): Promise<LedgerSubaccountResolution> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("El nombre de la subcuenta es obligatorio.")
  }

  const nextSequence = await findNextAccountSequenceForPrefix(companyId, parentCode)
  const accountCode = buildAccountCode(parentCode, nextSequence)

  return {
    parentCode,
    name: trimmedName,
    accountCode,
    formattedAccountCode: formatAccountCodeDisplay(accountCode),
    isNew: true,
    ledgerSubaccountId: null,
  }
}

export async function createLedgerSubaccountWithFixedCode(
  companyId: string,
  accountCode: string,
  name: string,
  extra?: {
    notes?: string
    address?: string
    phone?: string
    email?: string
  },
): Promise<LedgerSubaccountResolution> {
  const digits = accountCode.replace(/\D/g, "")
  const parentCode = inferParentCodeFromAccount(digits)
  if (!parentCode) {
    throw new Error("No se puede determinar la cuenta padre del código indicado.")
  }

  const meta = resolveAccountParentCode(parentCode)
  if (!meta || meta.isThirdParty) {
    throw new Error("El código no corresponde a una subcuenta del plan contable.")
  }

  if (!digits.startsWith(parentCode) || digits.length <= parentCode.length) {
    throw new Error("El código de subcuenta no es válido para la cuenta padre.")
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("El nombre de la subcuenta es obligatorio.")
  }

  const existing = await prisma.ledgerSubaccount.findFirst({
    where: { companyId, accountCode: digits },
  })
  if (existing) {
    return {
      parentCode: existing.parentCode,
      name: existing.name,
      accountCode: existing.accountCode,
      formattedAccountCode: formatAccountCodeDisplay(existing.accountCode),
      isNew: false,
      ledgerSubaccountId: existing.id,
    }
  }

  const created = await prisma.ledgerSubaccount.create({
    data: {
      companyId,
      parentCode: meta.code,
      accountCode: digits,
      name: trimmedName,
      notes: extra?.notes?.trim() || null,
      address: extra?.address?.trim() || null,
      phone: extra?.phone?.trim() || null,
      email: extra?.email?.trim() || null,
    },
  })

  return {
    parentCode: created.parentCode,
    name: created.name,
    accountCode: created.accountCode,
    formattedAccountCode: formatAccountCodeDisplay(created.accountCode),
    isNew: true,
    ledgerSubaccountId: created.id,
  }
}

export async function resolveOrCreateLedgerSubaccount(
  companyId: string,
  parentCode: string,
  name: string,
  extra?: {
    notes?: string
    address?: string
    phone?: string
    email?: string
  },
): Promise<LedgerSubaccountResolution> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error("El nombre de la subcuenta es obligatorio.")
  }

  const preview = await previewLedgerSubaccount(companyId, parentCode, trimmedName)

  const created = await prisma.ledgerSubaccount.create({
    data: {
      companyId,
      parentCode,
      accountCode: preview.accountCode,
      name: trimmedName,
      notes: extra?.notes?.trim() || null,
      address: extra?.address?.trim() || null,
      phone: extra?.phone?.trim() || null,
      email: extra?.email?.trim() || null,
    },
  })

  return {
    parentCode,
    name: created.name,
    accountCode: created.accountCode,
    formattedAccountCode: formatAccountCodeDisplay(created.accountCode),
    isNew: true,
    ledgerSubaccountId: created.id,
  }
}
