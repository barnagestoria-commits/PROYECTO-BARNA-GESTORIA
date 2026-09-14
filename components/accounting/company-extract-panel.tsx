"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { AccountDetailLevelPicker } from "@/components/accounting/account-detail-level-picker"
import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import type { CompanyChartPlanInfo } from "@/lib/reports/pgc-chart-plans"
import type { AccountBalance, ReportMeta } from "@/lib/reports/types"

export interface CompanyExtractResponse {
  meta: ReportMeta
  plan?: CompanyChartPlanInfo
  rows: AccountBalance[]
  totalDebe: number
  totalHaber: number
  accountsWithMovement?: number
  detailLevel?: GestoriaAccountDetailLevel
}

interface CompanyExtractPanelProps {
  year: number
  onSelectAccount?: (accountCode: string) => void
  onDoubleSelectAccount?: (accountCode: string) => void
}

export function CompanyExtractPanel({
  year,
  onSelectAccount,
  onDoubleSelectAccount,
}: CompanyExtractPanelProps) {
  const [extract, setExtract] = useState<CompanyExtractResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detailLevel, setDetailLevel] = useState<GestoriaAccountDetailLevel>("SUBCUENTAS")

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    apiFetch<{ success: true; extract: CompanyExtractResponse }>(
      `/api/accounting/company-extract?year=${year}&detail=${detailLevel}`,
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
  }, [year, detailLevel])

  const activeDetail = extract?.detailLevel ?? detailLevel

  return (
    <div className="space-y-4">
      <AccountDetailLevelPicker value={detailLevel} onChange={setDetailLevel} />

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
        <>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p className="mb-2 font-medium">
              {extract.meta.companyName}
              {extract.meta.companyCif ? ` · ${extract.meta.companyCif}` : ""} · {extract.meta.periodLabel}
            </p>
            {extract.plan ? (
              <p className="mb-2 text-emerald-900">
                {extract.plan.accountingPlanLabel}
                {" · "}
                Balance {extract.plan.balanceCode !== "—" ? `${extract.plan.balanceCode} ` : ""}
                {extract.plan.balanceLabel}
                {" · "}
                PyG {extract.plan.profitLossCode !== "—" ? `${extract.plan.profitLossCode} ` : ""}
                {extract.plan.profitLossLabel}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-4">
              <span>
                Cuentas: <strong>{extract.rows.length}</strong>
              </span>
              <span>
                Con movimiento:{" "}
                <strong>{extract.accountsWithMovement ?? extract.rows.length}</strong>
              </span>
              <span>
                Total debe: <strong>{formatEuro(extract.totalDebe)}</strong>
              </span>
              <span>
                Total haber: <strong>{formatEuro(extract.totalHaber)}</strong>
              </span>
            </div>
          </div>

          <div className="max-h-[640px] overflow-auto rounded-lg border border-sand-200 bg-white">
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
                {extract.rows.map((row) => {
                  const hasMovement =
                    row.totalDebe !== 0 || row.totalHaber !== 0 || row.saldo !== 0
                  const isSubaccount =
                    activeDetail === "SUBCUENTAS" && row.cuenta.replace(/\D/g, "").length > 3
                  return (
                    <tr
                      key={row.cuenta}
                      className={`cursor-pointer border-t border-sand-100 hover:bg-emerald-50/70 ${
                        hasMovement ? "text-graphite-900" : "text-graphite-400"
                      }`}
                      onClick={() => onSelectAccount?.(row.cuenta)}
                      onDoubleClick={() => onDoubleSelectAccount?.(row.cuenta)}
                    >
                      <td className={`px-3 py-2 font-mono ${isSubaccount ? "pl-8" : "font-semibold"}`}>
                        {formatAccountCodeDisplay(row.cuenta)}
                      </td>
                      <td className={`px-3 py-2 ${isSubaccount && hasMovement ? "font-medium" : ""}`}>
                        {row.label}
                      </td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
