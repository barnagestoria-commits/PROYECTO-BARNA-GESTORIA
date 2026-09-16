"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { PgcChartDialog } from "@/components/accounting/pgc-chart-dialog"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import type { AccountMovementRow } from "@/lib/accounting/account-movements-service"
import type { TransferredAccountMovements } from "@/lib/accounting/account-transfer-service"

interface TransferMovementsDialogProps {
  open: boolean
  fromAccountCode: string
  fromAccountLabel: string
  movements: AccountMovementRow[]
  onClose: () => void
  onTransferred: (result: TransferredAccountMovements) => void
}

export function TransferMovementsDialog({
  open,
  fromAccountCode,
  fromAccountLabel,
  movements,
  onClose,
  onTransferred,
}: TransferMovementsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [destination, setDestination] = useState<{ code: string; name: string } | null>(null)
  const [pgcOpen, setPgcOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedIds(new Set())
    setDestination(null)
    setPgcOpen(false)
    setError(null)
  }, [open, fromAccountCode])

  const allSelected = movements.length > 0 && selectedIds.size === movements.length
  const formattedFrom = formatAccountCodeDisplay(fromAccountCode)

  const selectedCount = selectedIds.size
  const selectedLabel = useMemo(() => {
    if (!destination) return null
    return `${formatAccountCodeDisplay(destination.code)} · ${destination.name}`
  }, [destination])

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(movements.map((row) => row.id)))
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleTransfer = async () => {
    if (!destination) {
      setError("Selecciona la cuenta destino en el plan contable.")
      return
    }
    if (selectedIds.size === 0) {
      setError("Selecciona al menos un movimiento.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const data = await apiFetch<{ success: true; transfer: TransferredAccountMovements }>(
        "/api/accounting/accounts/transfer-movements",
        {
          method: "POST",
          body: JSON.stringify({
            fromAccountCode,
            toAccountCode: destination.code,
            lineIds: [...selectedIds],
          }),
        },
      )
      onTransferred(data.transfer)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo traspasar los movimientos.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <AccountingModal
        open={open}
        title="Traspaso entre cuentas"
        subtitle={`${formattedFrom} · ${fromAccountLabel}`}
        onClose={onClose}
        className="max-w-4xl"
        layer="nested"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-graphite-500">
              {selectedCount} movimiento{selectedCount === 1 ? "" : "s"} seleccionado
              {selectedCount === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-emerald-800 hover:bg-pine-900"
                disabled={isSaving || selectedCount === 0 || !destination}
                onClick={() => void handleTransfer()}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ArrowRightLeft className="mr-1 h-4 w-4" />
                    Traspasar
                  </>
                )}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
              Cuenta destino
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-semibold text-emerald-950">
                {selectedLabel ?? "Selecciona una cuenta del plan contable"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-emerald-300 bg-white text-emerald-900"
                onClick={() => setPgcOpen(true)}
              >
                Plan contable
              </Button>
            </div>
          </div>

          <div className="max-h-[360px] overflow-auto rounded-lg border border-sand-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todos los movimientos"
                    />
                  </th>
                  <th className="px-3 py-2">Ref.</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2">Contrapartida</th>
                  <th className="px-3 py-2 text-right">Debe</th>
                  <th className="px-3 py-2 text-right">Haber</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-graphite-500">
                      No hay movimientos para traspasar.
                    </td>
                  </tr>
                ) : (
                  movements.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-sand-100 hover:bg-emerald-50/70"
                      onClick={() => toggleRow(row.id)}
                    >
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Seleccionar asiento ${row.refNumber}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{row.refNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.fecha}</td>
                      <td className="px-3 py-2">{row.concepto || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.contrapartida ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.debe ? formatEuro(row.debe) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.haber ? formatEuro(row.haber) : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-xs text-graphite-500">
              Elige los asientos y la cuenta destino. Solo se traspasan las líneas seleccionadas;
              el resto de la ficha se mantiene.
            </p>
          )}
        </div>
      </AccountingModal>

      <PgcChartDialog
        open={pgcOpen}
        onClose={() => setPgcOpen(false)}
        title="Plan General Contable"
        subtitle="Selecciona la cuenta destino del traspaso"
        layer="top"
        onSelect={(accountCode, accountName) => {
          setDestination({ code: accountCode, name: accountName })
          setError(null)
        }}
      />
    </>
  )
}
