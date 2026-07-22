import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

export interface LedgerSubaccountResolution {
  parentCode: string
  name: string
  accountCode: string
  formattedAccountCode: string
  isNew: boolean
  ledgerSubaccountId: string | null
}

export interface LedgerSubaccountOption {
  id: string
  parentCode: string
  name: string
  accountCode: string
  formattedAccountCode: string
}

export function ledgerSubaccountToOption(record: {
  id: string
  parentCode: string
  name: string
  accountCode: string
}): LedgerSubaccountOption {
  return {
    id: record.id,
    parentCode: record.parentCode,
    name: record.name,
    accountCode: record.accountCode,
    formattedAccountCode: formatAccountCodeDisplay(record.accountCode),
  }
}
