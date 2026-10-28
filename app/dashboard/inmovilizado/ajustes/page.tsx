"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { Loader2, Scale } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"
import {
  ADJUSTMENT_KIND_LABELS,
  type ExtracontableReport,
  type FixedAssetAdjustmentKind,
} from "@/lib/fixed-assets/extracontable"

type Filter = "TODOS" | Exclude<FixedAssetAdjustmentKind, "NINGUNO">

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "TODOS", label: "Todos" },
  { id: "LIBRE_ACELERADA", label: "Amortización libre y acelerada" },
  { id: "ARRENDAMIENTO", label: "Arrendamiento financiero" },
  { id: "LEY_16_2012", label: "Correcciones 30 % Ley 16/2012" },
]

function euros(value: number): string {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function cell(value: number): string {
  return value === 0 ? "" : euros(value)
}

export default function AjustesExtracontablesPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [filter, setFilter] = useState<Filter>("TODOS")
  const [taxRate, setTaxRate] = useState(25)
  const [report, setReport] = useState<ExtracontableReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{
        success: true
        taxRate: number
        report: ExtracontableReport
      }>(`/api/fixed-assets/extracontable?year=${year}`)
      setTaxRate(data.taxRate)
      setReport(data.report)
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : "No se pudo calcular el listado.")
    } finally {
      setIsLoading(false)
    }
  }, [year])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const rows = (report?.rows ?? []).filter((row) => filter === "TODOS" || row.adjustmentKind === filter)
  const increase = rows.reduce((sum, row) => sum + row.increase, 0)
  const decrease = rows.reduce((sum, row) => sum + row.decrease, 0)
  const groups = FILTERS.filter((item) => item.id !== "TODOS").map((item) => ({
    ...item,
    rows: rows.filter((row) => row.adjustmentKind === item.id),
  }))

  return (
    <div className="min-w-0 space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <Scale className="h-5 w-5" />
            Ajustes extracontables del ejercicio {year}
          </CardTitle>
          <CardDescription>
            Diferencia entre la amortización contable y la fiscal. El aumento o la disminución entra
            en el pago fraccionado (modelo 202) y en el impuesto sobre sociedades (modelo 200).
            El impuesto diferido usa el tipo del {taxRate} %.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <label className="text-sm text-graphite-700">
            Ejercicio
            <input
              type="number"
              className="mt-1 h-10 w-28 rounded-md border px-3 text-sm"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            {FILTERS.map((item) => (
              <label key={item.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ajuste"
                  checked={filter === item.id}
                  onChange={() => setFilter(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-graphite-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando ajustes…
        </div>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-graphite-600">
          No hay activos con ajuste extracontable en este ejercicio. En la ficha del inmovilizado,
          elige el tipo de ajuste e indica el coeficiente fiscal anual.
        </p>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto px-0 pt-4">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="text-left text-xs text-graphite-500">
                <tr>
                  <th className="px-4 py-2">Activo</th>
                  <th className="px-2 py-2 text-right">Amort. contable</th>
                  <th className="px-2 py-2 text-right">Amort. fiscal</th>
                  <th className="px-2 py-2 text-right">Variación</th>
                  <th className="px-2 py-2 text-right">Acum. contable</th>
                  <th className="px-2 py-2 text-right">Acum. fiscal</th>
                  <th className="px-4 py-2 text-right">Impuesto diferido</th>
                </tr>
              </thead>
              <tbody>
                {(filter === "TODOS" ? groups : [{ id: filter, label: ADJUSTMENT_KIND_LABELS[filter], rows }]).map(
                  (group) =>
                    group.rows.length === 0 ? null : (
                      <Fragment key={group.id}>
                        <tr className="bg-emerald-50/70">
                          <td colSpan={7} className="px-4 py-2 font-medium text-emerald-900">
                            {group.label}
                          </td>
                        </tr>
                        {group.rows.map((row) => (
                          <tr key={row.code} className="border-t">
                            <td className="px-4 py-2">
                              {row.code} {row.name}
                            </td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">{cell(row.accountingPeriod)}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">{cell(row.fiscalPeriod)}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">{cell(row.variationPeriod)}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">{cell(row.accountingAccumulated)}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">{cell(row.fiscalAccumulated)}</td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums">{cell(row.deferredPeriod)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ),
                )}
              </tbody>
            </table>
            <div className="space-y-1 px-4 py-4 text-sm">
              <p>
                Total corrección contable: Aumento{" "}
                <span className="font-mono tabular-nums">{increase === 0 ? "" : euros(increase)}</span>
              </p>
              <p>
                Total corrección contable: Disminución{" "}
                <span className="font-mono tabular-nums">{decrease === 0 ? "" : euros(decrease)}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
