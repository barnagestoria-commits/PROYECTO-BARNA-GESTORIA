"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import type { CalculationDetailRow } from "@/lib/fiscal/model-draft/types"
import { cn } from "@/lib/utils"

interface FiscalCalculationDetailDialogProps {
  open: boolean
  title: string
  subtitle?: string
  rows: CalculationDetailRow[]
  onClose: () => void
  onOpenEntry?: (entryId: string) => void
}

export function FiscalCalculationDetailDialog({
  open,
  title,
  subtitle,
  rows,
  onClose,
  onOpenEntry,
}: FiscalCalculationDetailDialogProps) {
  return (
    <AccountingModal
      open={open}
      title={title}
      subtitle={subtitle ?? "Datos del cálculo"}
      onClose={onClose}
      className="max-w-5xl"
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-graphite-500">
          No hay operaciones vinculadas a esta casilla en el periodo.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-sand-100">
              <TableHead>Cuenta contable</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>Nombre o razón social</TableHead>
              <TableHead>Clave</TableHead>
              <TableHead className="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.cuenta}</TableCell>
                <TableCell className="font-mono text-xs">{row.nif}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className={cn(
                      "text-left text-sm",
                      onOpenEntry && "text-emerald-800 underline-offset-2 hover:underline",
                    )}
                    onClick={() => onOpenEntry?.(row.entryId)}
                  >
                    {row.nombre}
                  </button>
                  <p className="text-xs text-graphite-500">{row.concepto}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.claveOperacion}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatFiscalAmount(row.importe)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AccountingModal>
  )
}
