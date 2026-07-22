"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import type { AccountBalance } from "@/lib/reports/types"
import type { ReportMeta } from "@/lib/reports/types"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

interface CompanyExtractResponse {
  meta: ReportMeta
  rows: AccountBalance[]
  totalDebe: number
  totalHaber: number
}

interface CompanyExtractDialogProps {
  open: boolean
  year: number
  onClose: () => void
  onSelectAccount?: (accountCode: string) => void
}

export function CompanyExtractDialog({
  open,
  year,
  onClose,
  onSelectAccount,
}: CompanyExtractDialogProps) {
  const [extract, setExtract] = useState<CompanyExtractResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setExtract(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    apiFetch<{ success: true; extract: CompanyExtractResponse }>(
      `/api/accounting/company-extract?year=${year}`,
    )
      .then((data) => {
        if (!cancelled) setExtract(data.extract)
      })
      .catch((err) => {
        if (!cancelled) {
          setExtract(null)
          setError(err instanceof Error ? err.message : "No se pudo cargar el extracto.")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, year])

  return (
    <AccountingModal
      open={open}
      title="EX · Extracto de cuentas"
      subtitle={
        extract
          ? `${extract.meta.companyName}${extract.meta.companyCif ? ` · ${extract.meta.companyCif}` : ""} · ${extract.meta.periodLabel}`
          : `Ejercicio ${year}`
      }
      onClose={onClose}
      className="max-w-5xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-emerald-800">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando extracto…
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : extract ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <div className="flex flex-wrap gap-4">
              <span>Cuentas con movimiento: <strong>{extract.rows.length}</strong></span>
              <span>Total debe: <strong>{formatEuro(extract.totalDebe)}</strong></span>
              <span>Total haber: <strong>{formatEuro(extract.totalHaber)}</strong></span>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-lg border border-sand-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-sand-100 text-left text-xs uppercase tracking-wide text-graphite-600">
                <tr>
                  <th className="px-3 py-2">Cuenta</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2 text-right">Debe</th>
                  <th className="px-3 py-2 text-right">Haber</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {extract.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-graphite-500">
                      No hay movimientos contables para este cliente en {year}.
                    </td>
                  </tr>
                ) : (
                  extract.rows.map((row) => (
                    <tr
                      key={row.cuenta}
                      className="cursor-pointer border-t border-sand-100 hover:bg-emerald-50/70"
                      onClick={() => onSelectAccount?.(row.cuenta)}
                      onDoubleClick={() => {
                        onSelectAccount?.(row.cuenta)
                        onClose()
                      }}
                    >
                      <td className="px-3 py-2 font-mono">
                        {formatAccountCodeDisplay(row.cuenta)}
                      </td>
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatEuro(row.totalDebe)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatEuro(row.totalHaber)}
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
            Clic en una cuenta para consultar su extracto detallado de movimientos.
          </p>
        </div>
      ) : null}
    </AccountingModal>
  )
}
