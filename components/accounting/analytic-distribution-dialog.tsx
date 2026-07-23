"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import type { AnalyticDistributionInput } from "@/lib/accounting/analytic-accounting-types"
import { validateAnalyticDistributions } from "@/lib/accounting/analytic-accounting-types"

interface CostCenterOption {
  id: string
  code: string
  name: string
}

interface DistributionRow extends AnalyticDistributionInput {
  key: string
}

interface AnalyticDistributionDialogProps {
  open: boolean
  accountCode: string
  concepto: string
  totalAmount: number
  initialDistributions?: AnalyticDistributionInput[]
  onClose: () => void
  onSave: (distributions: AnalyticDistributionInput[]) => void
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function createRow(partial?: Partial<DistributionRow>): DistributionRow {
  return {
    key: partial?.key ?? crypto.randomUUID(),
    costCenterId: partial?.costCenterId ?? "",
    percentage: partial?.percentage ?? 0,
    amount: partial?.amount ?? 0,
  }
}

export function AnalyticDistributionDialog({
  open,
  accountCode,
  concepto,
  totalAmount,
  initialDistributions,
  onClose,
  onSave,
}: AnalyticDistributionDialogProps) {
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [rows, setRows] = useState<DistributionRow[]>([createRow()])
  const [error, setError] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [loadingCenters, setLoadingCenters] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setRows(
      initialDistributions?.length
        ? initialDistributions.map((item) => createRow({ ...item, key: crypto.randomUUID() }))
        : [createRow({ percentage: 100, amount: totalAmount })],
    )
  }, [open, initialDistributions, totalAmount])

  useEffect(() => {
    if (!open) return
    setLoadingCenters(true)
    apiFetch<{ success: true; costCenters: CostCenterOption[] }>("/api/cost-centers")
      .then((data) => setCostCenters(data.costCenters))
      .catch(() => setCostCenters([]))
      .finally(() => setLoadingCenters(false))
  }, [open])

  const pendingAmount = useMemo(() => {
    const assigned = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    return round2(totalAmount - assigned)
  }, [rows, totalAmount])

  const pendingPercentage = useMemo(() => {
    const assigned = rows.reduce((sum, row) => sum + (Number(row.percentage) || 0), 0)
    return round2(100 - assigned)
  }, [rows])

  const updateRow = (key: string, patch: Partial<DistributionRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row
        const next = { ...row, ...patch }
        if (patch.percentage !== undefined && totalAmount > 0) {
          next.amount = round2((totalAmount * (Number(patch.percentage) || 0)) / 100)
        }
        if (patch.amount !== undefined && totalAmount > 0) {
          next.percentage = round2(((Number(patch.amount) || 0) / totalAmount) * 100)
        }
        return next
      }),
    )
  }

  const applyAutomaticDistribution = async () => {
    setLoadingTemplate(true)
    setError(null)
    try {
      const data = await apiFetch<{
        success: true
        template: Array<{ costCenterId: string; percentage: number }>
      }>(`/api/accounting/analytic-template?accountCode=${encodeURIComponent(accountCode)}`)

      if (data.template.length === 0) {
        setError("No hay distribución anterior guardada para esta cuenta.")
        return
      }

      setRows(
        data.template.map((item) =>
          createRow({
            costCenterId: item.costCenterId,
            percentage: item.percentage,
            amount: round2((totalAmount * item.percentage) / 100),
          }),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la distribución automática.")
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleSave = () => {
    const distributions = rows
      .filter((row) => row.costCenterId && (row.percentage > 0 || row.amount > 0))
      .map(({ costCenterId, percentage, amount }) => ({
        costCenterId,
        percentage: round2(percentage),
        amount: round2(amount),
      }))

    const validationError = validateAnalyticDistributions(totalAmount, distributions)
    if (validationError) {
      setError(validationError)
      return
    }

    onSave(distributions)
  }

  return (
    <AccountingModal
      open={open}
      title="Distribución analítica del importe"
      subtitle={`${accountCode}${concepto ? ` · ${concepto}` : ""}`}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void applyAutomaticDistribution()}
            disabled={loadingTemplate}
          >
            {loadingTemplate ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Distribución automática
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              Aceptar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-sand-200 bg-sand-50 p-3 text-sm">
          <div>
            <p className="text-xs text-graphite-500">Importe del apunte</p>
            <p className="font-mono font-semibold">{totalAmount.toFixed(2)} €</p>
          </div>
          <div>
            <p className="text-xs text-graphite-500">Pendiente (%)</p>
            <p className="font-mono font-semibold">{pendingPercentage.toFixed(2)} %</p>
          </div>
          <div>
            <p className="text-xs text-graphite-500">Pendiente (€)</p>
            <p className="font-mono font-semibold">{pendingAmount.toFixed(2)} €</p>
          </div>
        </div>

        {loadingCenters ? (
          <div className="flex items-center gap-2 text-sm text-graphite-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando centros de coste…
          </div>
        ) : costCenters.length === 0 ? (
          <p className="text-sm text-amber-700">
            No hay centros de coste configurados. Créalos en Contabilidad → Centros de coste.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.key} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-5 space-y-1">
                  {index === 0 && <Label className="text-xs">Centro de coste</Label>}
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={row.costCenterId}
                    onChange={(event) => updateRow(row.key, { costCenterId: event.target.value })}
                  >
                    <option value="">Seleccionar…</option>
                    {costCenters.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.code} · {center.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">%</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={row.percentage || ""}
                    onChange={(event) =>
                      updateRow(row.key, { percentage: Number.parseFloat(event.target.value) || 0 })
                    }
                    className="h-9 text-right font-mono"
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  {index === 0 && <Label className="text-xs">Importe</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.amount || ""}
                    onChange={(event) =>
                      updateRow(row.key, { amount: Number.parseFloat(event.target.value) || 0 })
                    }
                    className="h-9 text-right font-mono"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-600"
                    onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                    disabled={rows.length <= 1}
                    aria-label="Eliminar fila"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((prev) => [...prev, createRow()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir centro
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </AccountingModal>
  )
}
