"use client"

import { Button } from "@/components/ui/button"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import type { AccountExistenceResult } from "@/lib/accounting/account-exists-service"

interface MissingAccountDialogProps {
  open: boolean
  year: number
  account: AccountExistenceResult | null
  onConfirm: () => void
  onCancel: () => void
}

export function MissingAccountDialog({
  open,
  year,
  account,
  onConfirm,
  onCancel,
}: MissingAccountDialogProps) {
  if (!account) return null

  return (
    <AccountingModal
      open={open}
      title="Cuenta no dada de alta"
      subtitle={`Ejercicio ${year}`}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            No
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!account.canQuickCreate}>
            Sí, dar de alta
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-graphite-700">
        La cuenta <strong className="font-mono">{account.formattedAccountCode}</strong> no ha sido dada
        de alta en el ejercicio <strong>{year}</strong>. ¿Desea hacerlo ahora?
      </p>
      {account.label && (
        <p className="mt-2 text-xs text-graphite-500">
          Cuenta padre: {account.parentCode} · {account.label}
        </p>
      )}
      {!account.canQuickCreate && (
        <p className="mt-3 text-xs text-amber-700">
          No se puede crear automáticamente esta cuenta. Corrige el código o usa el plan contable (F4).
        </p>
      )}
    </AccountingModal>
  )
}
