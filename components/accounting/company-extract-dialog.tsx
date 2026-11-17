"use client"

import { AccountingModal } from "@/components/accounting/accounting-modal"
import { CompanyExtractPanel } from "@/components/accounting/company-extract-panel"
import { AccountingExerciseYearSelect } from "@/components/accounting/accounting-exercise-year-select"

interface CompanyExtractDialogProps {
  open: boolean
  year: number
  yearOptions?: number[]
  onYearChange?: (year: number) => void
  onClose: () => void
  onSelectAccount?: (accountCode: string) => void
  onEditAccount?: (accountCode: string, accountName: string) => void
  onReleaseAccount?: (accountCode: string, accountName: string) => void
  refreshKey?: number
}

export function CompanyExtractDialog({
  open,
  year,
  yearOptions,
  onYearChange,
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
        <div className="space-y-3">
          {onYearChange ? (
            <AccountingExerciseYearSelect
              year={year}
              options={yearOptions ?? [year - 1, year, year + 1]}
              onChange={onYearChange}
              id="company-extract-year"
              compact
            />
          ) : null}
          <CompanyExtractPanel
          year={year}
          onSelectAccount={onSelectAccount}
          onDoubleSelectAccount={onSelectAccount}
          onEditAccount={onEditAccount}
          onReleaseAccount={onReleaseAccount}
          autoFocusSearch
          refreshKey={refreshKey}
        />
        </div>
      ) : null}
    </AccountingModal>
  )
}
