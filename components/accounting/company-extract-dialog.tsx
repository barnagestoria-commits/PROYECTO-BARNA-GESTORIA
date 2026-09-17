"use client"

import { AccountingModal } from "@/components/accounting/accounting-modal"
import { CompanyExtractPanel } from "@/components/accounting/company-extract-panel"

interface CompanyExtractDialogProps {
  open: boolean
  year: number
  onClose: () => void
  onSelectAccount?: (accountCode: string) => void
  onEditAccount?: (accountCode: string, accountName: string) => void
  onReleaseAccount?: (accountCode: string, accountName: string) => void
  refreshKey?: number
}

export function CompanyExtractDialog({
  open,
  year,
  onClose,
  onSelectAccount,
  onEditAccount,
  onReleaseAccount,
  refreshKey,
}: CompanyExtractDialogProps) {
  return (
    <AccountingModal
      open={open}
      title="EX · Extracto de cuentas"
      subtitle={`Ejercicio ${year}`}
      onClose={onClose}
      className="max-w-5xl"
    >
      {open ? (
        <CompanyExtractPanel
          year={year}
          onSelectAccount={onSelectAccount}
          onDoubleSelectAccount={onSelectAccount}
          onEditAccount={onEditAccount}
          onReleaseAccount={onReleaseAccount}
          autoFocusSearch
          refreshKey={refreshKey}
        />
      ) : null}
    </AccountingModal>
  )
}
