"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import {
  parseRefNumberInput,
  type AccountingEntryPurgeFilter,
  type AccountingEntryPurgeMode,
} from "@/lib/accounting/entry-service"

const CONFIRM_WORD = "BORRAR"

interface AccountingVolume {
  entryCount: number
  lineCount: number
  importCount: number
  matchedBankMovementCount: number
}

interface PurgeAccountingEntriesPanelProps {
  companyId: string
  companyName: string
  /** Cambia este valor para releer el número de asientos tras una importación. */
  refreshKey?: number
  onPurged?: () => void
}

const MODE_OPTIONS: Array<{ value: AccountingEntryPurgeMode; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "quarter", label: "Por trimestre" },
  { value: "ref", label: "Por asiento" },
]

function buildFilterQuery(
  filter: AccountingEntryPurgeFilter,
  refsInput?: string,
): string {
  const params = new URLSearchParams({ mode: filter.mode })
  if (filter.mode === "quarter") {
    if (filter.year) params.set("year", String(filter.year))
    if (filter.quarter) params.set("quarter", String(filter.quarter))
  }
  if (filter.mode === "ref" && refsInput?.trim()) {
    params.set("refs", refsInput.trim())
  }
  return params.toString()
}

function describeFilter(filter: AccountingEntryPurgeFilter, refsInput?: string): string {
  if (filter.mode === "quarter" && filter.year && filter.quarter) {
    return `el ${filter.quarter}T de ${filter.year}`
  }
  if (filter.mode === "ref") {
    const parsed = parseRefNumberInput(refsInput ?? "")
    if (!parsed) return "la selección indicada"
    if (parsed.refNumbers?.length) {
      return parsed.refNumbers.length === 1
        ? `el asiento ${parsed.refNumbers[0]}`
        : `los asientos ${parsed.refNumbers.join(", ")}`
    }
    if (parsed.refFrom != null && parsed.refTo != null) {
      return parsed.refFrom === parsed.refTo
        ? `el asiento ${parsed.refFrom}`
        : `los asientos del ${parsed.refFrom} al ${parsed.refTo}`
    }
  }
  return "toda la contabilidad"
}

export function PurgeAccountingEntriesPanel({
  companyId,
  companyName,
  refreshKey = 0,
  onPurged,
}: PurgeAccountingEntriesPanelProps) {
  const currentYear = new Date().getFullYear()
  const [totalVolume, setTotalVolume] = useState<AccountingVolume | null>(null)
  const [filteredVolume, setFilteredVolume] = useState<AccountingVolume | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [mode, setMode] = useState<AccountingEntryPurgeMode>("all")
  const [year, setYear] = useState(String(currentYear))
  const [quarter, setQuarter] = useState<"1" | "2" | "3" | "4">("2")
  const [refsInput, setRefsInput] = useState("")
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isPurging, setIsPurging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const activeFilter = useMemo<AccountingEntryPurgeFilter>(() => {
    if (mode === "quarter") {
      return {
        mode: "quarter",
        year: Number.parseInt(year, 10),
        quarter: Number.parseInt(quarter, 10) as 1 | 2 | 3 | 4,
      }
    }
    if (mode === "ref") {
      return { mode: "ref", ...parseRefNumberInput(refsInput) }
    }
    return { mode: "all" }
  }, [mode, quarter, refsInput, year])

  const loadTotalVolume = useCallback(async () => {
    if (!companyId) return
    setIsLoading(true)
    try {
      const data = await apiFetch<{ success: true; volume: AccountingVolume }>(
        `/api/accounting/entries/purge?companyId=${encodeURIComponent(companyId)}`,
      )
      setTotalVolume(data.volume)
    } catch {
      setTotalVolume(null)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  const loadFilteredVolume = useCallback(async () => {
    if (!companyId) return
    if (mode === "ref" && !refsInput.trim()) {
      setFilteredVolume(null)
      setPreviewError(null)
      return
    }

    setIsPreviewLoading(true)
    setPreviewError(null)
    try {
      const query = buildFilterQuery(activeFilter, refsInput)
      const data = await apiFetch<{ success: true; volume: AccountingVolume }>(
        `/api/accounting/entries/purge?companyId=${encodeURIComponent(companyId)}&${query}`,
      )
      setFilteredVolume(data.volume)
    } catch (err) {
      setFilteredVolume(null)
      setPreviewError(err instanceof Error ? err.message : "No se pudo calcular la selección.")
    } finally {
      setIsPreviewLoading(false)
    }
  }, [activeFilter, companyId, mode, refsInput])

  useEffect(() => {
    void loadTotalVolume()
  }, [loadTotalVolume, refreshKey])

  useEffect(() => {
    void loadFilteredVolume()
  }, [loadFilteredVolume, refreshKey])

  useEffect(() => {
    setIsConfirmOpen(false)
    setConfirmText("")
    setMessage(null)
    setError(null)
    setPreviewError(null)
  }, [companyId])

  const totalEntryCount = totalVolume?.entryCount ?? 0
  const selectedEntryCount =
    mode === "all" ? totalEntryCount : (filteredVolume?.entryCount ?? 0)
  const selectedLineCount =
    mode === "all" ? (totalVolume?.lineCount ?? 0) : (filteredVolume?.lineCount ?? 0)
  const selectedBankMatches =
    mode === "all"
      ? (totalVolume?.matchedBankMovementCount ?? 0)
      : (filteredVolume?.matchedBankMovementCount ?? 0)

  const canOpenConfirm =
    !isLoading &&
    !isPreviewLoading &&
    !previewError &&
    selectedEntryCount > 0 &&
    (mode !== "ref" || refsInput.trim().length > 0)

  const handlePurge = async () => {
    if (isPurging || confirmText.trim().toUpperCase() !== CONFIRM_WORD || !canOpenConfirm) return

    setIsPurging(true)
    setError(null)
    setMessage(null)

    const body: {
      companyId: string
      confirm: true
      filter?: AccountingEntryPurgeFilter | { mode: "ref"; refs: string }
    } = {
      companyId,
      confirm: true,
    }

    if (mode === "quarter") {
      body.filter = {
        mode: "quarter",
        year: Number.parseInt(year, 10),
        quarter: Number.parseInt(quarter, 10) as 1 | 2 | 3 | 4,
      }
    } else if (mode === "ref") {
      body.filter = { mode: "ref", refs: refsInput.trim() }
    } else {
      body.filter = { mode: "all" }
    }

    try {
      const data = await apiFetch<{
        success: true
        result: { entriesDeleted: number; importsDeleted: number; bankMovementsReset: number }
        filter: AccountingEntryPurgeFilter
      }>("/api/accounting/entries/purge", {
        method: "POST",
        body: JSON.stringify(body),
      })

      const scope = describeFilter(data.filter)
      let text = `Se han borrado ${data.result.entriesDeleted} asientos de ${scope} en ${companyName}`
      if (data.result.bankMovementsReset > 0) {
        text += ` y ${data.result.bankMovementsReset} movimientos bancarios han vuelto a pendiente`
      }
      if (data.result.importsDeleted > 0) {
        text += `; también se eliminó el historial de importaciones`
      }
      text += "."

      setMessage(text)
      setIsConfirmOpen(false)
      setConfirmText("")
      await loadTotalVolume()
      await loadFilteredVolume()
      onPurged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la contabilidad.")
    } finally {
      setIsPurging(false)
    }
  }

  const purgeButtonLabel =
    mode === "all" ? "Borrar todos los asientos" : "Borrar selección"

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" />
            Vaciar la contabilidad de {companyName}
          </p>
          <p className="mt-1 text-xs text-graphite-600">
            {isLoading
              ? "Consultando asientos..."
              : totalEntryCount === 0
                ? "Esta empresa no tiene asientos registrados."
                : `${totalEntryCount} asientos · ${totalVolume?.lineCount ?? 0} líneas · ${totalVolume?.importCount ?? 0} importaciones registradas`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
          disabled={!canOpenConfirm || isPurging}
          onClick={() => setIsConfirmOpen((open) => !open)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {purgeButtonLabel}
        </Button>
      </div>

      {totalEntryCount > 0 && (
        <div className="mt-3 space-y-3 rounded-lg border border-red-200 bg-white/70 p-3">
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={mode === option.value ? "default" : "outline"}
                className={
                  mode === option.value
                    ? "bg-red-700 text-white hover:bg-red-800"
                    : "border-red-200 text-red-800 hover:bg-red-50"
                }
                disabled={isPurging}
                onClick={() => {
                  setMode(option.value)
                  setIsConfirmOpen(false)
                  setConfirmText("")
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {mode === "quarter" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor={`purge-year-${companyId}`} className="text-xs text-graphite-600">
                  Ejercicio
                </Label>
                <Input
                  id={`purge-year-${companyId}`}
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="h-9 w-28"
                  disabled={isPurging}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`purge-quarter-${companyId}`} className="text-xs text-graphite-600">
                  Trimestre
                </Label>
                <select
                  id={`purge-quarter-${companyId}`}
                  value={quarter}
                  onChange={(event) => setQuarter(event.target.value as "1" | "2" | "3" | "4")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isPurging}
                >
                  <option value="1">1T (ene-mar)</option>
                  <option value="2">2T (abr-jun)</option>
                  <option value="3">3T (jul-sep)</option>
                  <option value="4">4T (oct-dic)</option>
                </select>
              </div>
            </div>
          )}

          {mode === "ref" && (
            <div className="space-y-1">
              <Label htmlFor={`purge-refs-${companyId}`} className="text-xs text-graphite-600">
                Número(s) de asiento / referencia
              </Label>
              <Input
                id={`purge-refs-${companyId}`}
                value={refsInput}
                onChange={(event) => setRefsInput(event.target.value)}
                placeholder="Ej: 646 · 100-200 · 646, 647, 981"
                className="h-9 max-w-md"
                disabled={isPurging}
              />
              <p className="text-[11px] text-graphite-500">
                Un asiento, varios separados por coma o un rango con guion.
              </p>
            </div>
          )}

          {mode !== "all" && (
            <p className="text-xs text-graphite-700">
              {isPreviewLoading ? (
                "Calculando selección..."
              ) : previewError ? (
                <span className="text-red-700">{previewError}</span>
              ) : (
                <>
                  Selección: <strong>{selectedEntryCount} asientos</strong>
                  {selectedLineCount > 0 ? ` · ${selectedLineCount} líneas` : null}
                  {selectedBankMatches > 0
                    ? ` · ${selectedBankMatches} conciliaciones bancarias afectadas`
                    : null}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {isConfirmOpen && canOpenConfirm && (
        <div className="mt-3 space-y-3 rounded-lg border border-red-300 bg-white p-3">
          <p className="text-xs text-graphite-700">
            Se borrarán <strong>{selectedEntryCount} asientos</strong> de{" "}
            <strong>{describeFilter(activeFilter, refsInput)}</strong> con todas sus líneas
            {mode === "all" ? (
              <>
                {" "}
                y el historial de importaciones de {companyName}
              </>
            ) : null}
            . Los movimientos bancarios conciliados de esa selección volverán a pendiente. Las
            fichas de proveedores y clientes se mantienen. Esta acción no se puede deshacer.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-graphite-600" htmlFor={`purge-confirm-${companyId}`}>
              Escribe {CONFIRM_WORD} para confirmar
            </label>
            <Input
              id={`purge-confirm-${companyId}`}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="h-9 w-40"
              autoComplete="off"
              disabled={isPurging}
            />
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isPurging || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={() => void handlePurge()}
            >
              {isPurging ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Borrar definitivamente
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPurging}
              onClick={() => {
                setIsConfirmOpen(false)
                setConfirmText("")
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
