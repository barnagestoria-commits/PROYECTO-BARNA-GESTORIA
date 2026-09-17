"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Search, Trash2 } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { formatEuro } from "@/lib/accounting/command-templates"
import { extractAccountMatchesSearch } from "@/lib/accounting/extract-account-search"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import { AccountDetailLevelPicker } from "@/components/accounting/account-detail-level-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  onEditAccount?: (accountCode: string, accountName: string) => void
  onReleaseAccount?: (accountCode: string, accountName: string) => void
  autoFocusSearch?: boolean
  refreshKey?: number
}

export function CompanyExtractPanel({
  year,
  onSelectAccount,
  onDoubleSelectAccount,
  onEditAccount,
  onReleaseAccount,
  autoFocusSearch = false,
  refreshKey = 0,
}: CompanyExtractPanelProps) {
  const [extract, setExtract] = useState<CompanyExtractResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [detailLevel, setDetailLevel] = useState<GestoriaAccountDetailLevel>("SUBCUENTAS")
  const [search, setSearch] = useState("")

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
  }, [year, detailLevel, refreshKey])

  const activeDetail = extract?.detailLevel ?? detailLevel
  const visibleRows = useMemo(() => {
    if (!extract) return []
    return extract.rows.filter((row) => extractAccountMatchesSearch(row, search))
  }, [extract, search])
  const hasSearch = search.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <AccountDetailLevelPicker value={detailLevel} onChange={setDetailLevel} />
        <div className="relative w-full lg:max-w-sm lg:pt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cuenta o descripción…"
            className="h-10 pl-10"
            aria-label="Buscar en el extracto de cuentas"
            autoFocus={autoFocusSearch}
          />
        </div>
      </div>

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
              {hasSearch ? (
                <span>
                  Coincidencias: <strong>{visibleRows.length}</strong>
                </span>
              ) : null}
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
                  {onEditAccount || onReleaseAccount ? <th className="w-16 px-1 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={onEditAccount || onReleaseAccount ? 6 : 5} className="px-3 py-10 text-center text-sm text-graphite-500">
                      Ninguna cuenta coincide con «{search.trim()}».
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
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
                        {onEditAccount || onReleaseAccount ? (
                          <td className="px-1 py-1">
                            {isSubaccount ? (
                              <div className="flex justify-end">
                                {onEditAccount ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-800 hover:bg-emerald-50"
                                    title="Editar cuenta"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onEditAccount(row.cuenta, row.label)
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                {onReleaseAccount ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    title="Eliminar cuenta"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onReleaseAccount(row.cuenta, row.label)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
