"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api-client"

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

export function PurgeAccountingEntriesPanel({
  companyId,
  companyName,
  refreshKey = 0,
  onPurged,
}: PurgeAccountingEntriesPanelProps) {
  const [volume, setVolume] = useState<AccountingVolume | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isPurging, setIsPurging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadVolume = useCallback(async () => {
    if (!companyId) return
    setIsLoading(true)
    try {
      const data = await apiFetch<{ success: true; volume: AccountingVolume }>(
        `/api/accounting/entries/purge?companyId=${encodeURIComponent(companyId)}`,
      )
      setVolume(data.volume)
    } catch {
      setVolume(null)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadVolume()
  }, [loadVolume, refreshKey])

  useEffect(() => {
    setIsConfirmOpen(false)
    setConfirmText("")
    setMessage(null)
    setError(null)
  }, [companyId])

  const handlePurge = async () => {
    if (isPurging || confirmText.trim().toUpperCase() !== CONFIRM_WORD) return

    setIsPurging(true)
    setError(null)
    setMessage(null)

    try {
      const data = await apiFetch<{
        success: true
        result: { entriesDeleted: number; importsDeleted: number; bankMovementsReset: number }
      }>("/api/accounting/entries/purge", {
        method: "POST",
        body: JSON.stringify({ companyId, confirm: true }),
      })

      let text = `Se han borrado ${data.result.entriesDeleted} asientos de ${companyName}`
      if (data.result.bankMovementsReset > 0) {
        text += ` y ${data.result.bankMovementsReset} movimientos bancarios han vuelto a pendiente`
      }
      text += "."

      setMessage(text)
      setIsConfirmOpen(false)
      setConfirmText("")
      await loadVolume()
      onPurged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la contabilidad.")
    } finally {
      setIsPurging(false)
    }
  }

  const entryCount = volume?.entryCount ?? 0

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
              : entryCount === 0
                ? "Esta empresa no tiene asientos registrados."
                : `${entryCount} asientos · ${volume?.lineCount ?? 0} líneas · ${volume?.importCount ?? 0} importaciones registradas`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
          disabled={isLoading || entryCount === 0 || isPurging}
          onClick={() => setIsConfirmOpen((open) => !open)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Borrar todos los asientos
        </Button>
      </div>

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

      {isConfirmOpen && entryCount > 0 && (
        <div className="mt-3 space-y-3 rounded-lg border border-red-300 bg-white p-3">
          <p className="text-xs text-graphite-700">
            Se borrarán <strong>{entryCount} asientos</strong> con todas sus líneas y el historial de
            importaciones de {companyName}. Los movimientos bancarios conciliados volverán a
            pendiente. Las fichas de proveedores y clientes se mantienen. Esta acción no se puede
            deshacer.
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
