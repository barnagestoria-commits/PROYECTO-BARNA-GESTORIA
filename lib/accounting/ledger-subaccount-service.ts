import { prisma } from "@/lib/db"
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
