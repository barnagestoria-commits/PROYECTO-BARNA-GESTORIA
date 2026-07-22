"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import type { AccountMovementsSummary } from "@/lib/accounting/account-movements-service"

interface AccountMovementsDialogProps {
  open: boolean
  cuenta: string | null
  year?: number
  refreshKey?: number
  onClose: () => void
  onOpenEntry?: (entryId: string) => void
}

export function AccountMovementsDialog({
  open,
  cuenta,
  year = new Date().getFullYear(),
  refreshKey = 0,
  onClose,
  onOpenEntry,
}: AccountMovementsDialogProps) {
  const [summary, setSummary] = useState<AccountMovementsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !cuenta) {
      setSummary(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    apiFetch<{ success: true; summary: AccountMovementsSummary }>(
      `/api/accounting/account-movements?cuenta=${encodeURIComponent(cuenta)}&year=${year}`,
    )
      .then((data) => {
        if (!cancelled) setSummary(data.summary)
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null)
          setError(err instanceof Error ? err.message : "No se pudieron cargar los movimientos.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cuenta, open, refreshKey, year])

  return (
    <AccountingModal
      open={open}
      title="Extracto de cuenta"
      subtitle={cuenta ? `EX · Movimientos del ejercicio ${year}` : undefined}
      onClose={onClose}
      className="max-w-5xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-emerald-800">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando movimientos…
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : summary ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <div className="font-semibold">
              {summary.formattedCuenta} · {summary.label}
            </div>
            <div className="mt-1 flex flex-wrap gap-4">
              <span>Debe: {formatEuro(summary.totalDebe)}</span>
              <span>Haber: {formatEuro(summary.totalHaber)}</span>
              <span>
                Saldo: <strong>{formatEuro(summary.closingBalance)}</strong>
              </span>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-lg border border-sand-200">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2">Contrapartida</th>
                  <th className="px-3 py-2 text-right">Debe</th>
                  <th className="px-3 py-2 text-right">Haber</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {summary.movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-graphite-500">
                      No hay movimientos para esta cuenta en {year}.
                    </td>
                  </tr>
                ) : (
                  summary.movements.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-sand-100 hover:bg-emerald-50/70"
                      onClick={() => onOpenEntry?.(row.entryId)}
                      onDoubleClick={() => onOpenEntry?.(row.entryId)}
                      title="Clic para modificar el asiento"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.fecha}</td>
                      <td className="px-3 py-2">{row.concepto || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.contrapartida ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.debe ? formatEuro(row.debe) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {row.haber ? formatEuro(row.haber) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatEuro(row.saldo)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-graphite-500">
            Haz clic en un movimiento para abrir y modificar el asiento, incluidas fechas de expedición y
            operación.
          </p>
        </div>
      ) : null}
    </AccountingModal>
  )
}
