"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import type { DuplicateInvoiceMatch } from "@/lib/accounting/duplicate-invoice"
import { describeDuplicateInvoice } from "@/lib/accounting/duplicate-invoice-message"

interface DuplicateInvoiceDialogProps {
  open: boolean
  duplicate: DuplicateInvoiceMatch | null
  blockDuplicates: boolean
  onDismiss: () => void
  onAllow: () => void
}

export function DuplicateInvoiceDialog({
  open,
  duplicate,
  blockDuplicates,
  onDismiss,
  onAllow,
}: DuplicateInvoiceDialogProps) {
  if (!duplicate) return null

  return (
    <AccountingModal
      open={open}
      title="Factura duplicada"
        subtitle="Ya hay un asiento con los mismos datos"
      tone="danger"
      onClose={onDismiss}
      layer="nested"
      className="max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDismiss}>
            No, revisar
          </Button>
          <Button
            type="button"
            className="bg-red-700 text-white hover:bg-red-800"
            onClick={onAllow}
          >
            Sí, registrar de todos modos
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 text-red-800">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" aria-hidden="true" />
        <div className="space-y-2 text-sm leading-relaxed">
          <p className="font-semibold">
            Esta factura ya parece contabilizada. ¿Quieres registrarla de todos modos?
          </p>
          <p className="font-medium">{describeDuplicateInvoice(duplicate)}</p>
          {blockDuplicates ? (
            <p className="text-xs font-medium text-red-700">
              La detección de duplicadas está activa: no se podrá confirmar hasta que elijas
              registrar de todos modos.
            </p>
          ) : (
            <p className="text-xs text-red-700">
              Si no es la misma factura, revisa el número o el proveedor antes de continuar.
            </p>
          )}
        </div>
      </div>
    </AccountingModal>
  )
}
