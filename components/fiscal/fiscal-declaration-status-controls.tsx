"use client"

import { useEffect, useState } from "react"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import type { FiscalModelId, FiscalPeriodKey } from "@/lib/types/fiscal-panorama"
import { cn } from "@/lib/utils"

type UiStatus = "pendiente" | "presentado" | "sin_datos"

interface FiscalDeclarationStatusControlsProps {
  modelCode: FiscalModelId
  year: number
  period: FiscalPeriodKey
  status: UiStatus
  notes?: string | null
  submittedAt?: string | null
  onUpdated?: () => void | Promise<void>
  compact?: boolean
}

function toApiStatus(status: UiStatus): string {
  return status.toUpperCase()
}

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

export function FiscalDeclarationStatusControls({
  modelCode,
  year,
  period,
  status,
  notes: initialNotes = null,
  submittedAt: initialSubmittedAt = null,
  onUpdated,
  compact = false,
}: FiscalDeclarationStatusControlsProps) {
  const [localStatus, setLocalStatus] = useState<UiStatus>(status)
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [submittedAt, setSubmittedAt] = useState(dateInputValue(initialSubmittedAt))
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocalStatus(status)
    setNotes(initialNotes ?? "")
    setSubmittedAt(dateInputValue(initialSubmittedAt))
  }, [initialNotes, initialSubmittedAt, status])

  const save = async (statusOverride?: UiStatus) => {
    const statusToSave = statusOverride ?? localStatus
    if (statusOverride) setLocalStatus(statusOverride)
    setIsSaving(true)
    setError(null)
    try {
      await apiFetch("/api/fiscal/declarations", {
        method: "PUT",
        body: JSON.stringify({
          modelCode,
          year,
          period,
          status: toApiStatus(statusToSave),
          notes: statusOverride ? initialNotes ?? "" : notes,
          submittedAt:
            statusOverride && statusToSave === "presentado" && !submittedAt
              ? new Date().toISOString()
              : submittedAt
                ? `${submittedAt}T12:00:00.000Z`
                : null,
        }),
      })
      await onUpdated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el estado.")
    } finally {
      setIsSaving(false)
    }
  }

  const resetAutomatic = async () => {
    setIsResetting(true)
    setError(null)
    try {
      await apiFetch(
        `/api/fiscal/declarations?modelCode=${encodeURIComponent(modelCode)}&year=${year}&period=${period}`,
        { method: "DELETE" },
      )
      await onUpdated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer el estado.")
    } finally {
      setIsResetting(false)
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap justify-end gap-1">
          {(
            [
              { id: "pendiente", label: "Pendiente" },
              { id: "presentado", label: "Presentado" },
              { id: "sin_datos", label: "SD" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              title={`Marcar como ${option.label}`}
              className={cn(
                "rounded border px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide",
                localStatus === option.id
                  ? option.id === "presentado"
                    ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                    : option.id === "pendiente"
                      ? "border-red-300 bg-red-100 text-red-800"
                      : "border-gray-300 bg-gray-100 text-gray-700"
                  : "border-sand-200 bg-white text-graphite-500 hover:bg-sand-50",
              )}
              onClick={() => void save(option.id)}
              disabled={isSaving}
            >
              {isSaving && localStatus === option.id ? "…" : option.label}
            </button>
          ))}
        </div>
        {error ? <span className="max-w-[160px] text-right text-[10px] text-red-700">{error}</span> : null}
      </div>
    )
  }

  return (
    <section className="border border-black bg-[#f7f7f7] px-4 py-4 text-sm text-slate-900">
      <h3 className="text-sm font-bold text-[#1a4480]">Estado de presentación</h3>
      <p className="mt-1 text-xs text-slate-600">
        Marca si ya lo presentaste fuera de Taxlyn (con NRC, fuera de plazo, etc.). Cuando presentemos desde
        aquí con tu CIF, Taxlyn lo marcará solo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { id: "pendiente", label: "Pendiente" },
            { id: "presentado", label: "Presentado" },
            { id: "sin_datos", label: "Sin datos (SD)" },
          ] as const
        ).map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={localStatus === option.id ? "default" : "outline"}
            className={cn(
              localStatus === option.id && option.id === "presentado" && "bg-emerald-700 hover:bg-emerald-800",
              localStatus === option.id && option.id === "pendiente" && "bg-red-700 hover:bg-red-800",
            )}
            onClick={() => setLocalStatus(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`decl-submitted-${modelCode}-${period}`}>Fecha de presentación</Label>
          <Input
            id={`decl-submitted-${modelCode}-${period}`}
            type="date"
            value={submittedAt}
            onChange={(event) => setSubmittedAt(event.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`decl-notes-${modelCode}-${period}`}>NRC / notas</Label>
          <textarea
            id={`decl-notes-${modelCode}-${period}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="NRC, justificante, observaciones…"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={isSaving} onClick={() => void save()}>
          {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Guardar estado
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isResetting}
          onClick={() => void resetAutomatic()}
        >
          {isResetting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
          Volver al automático
        </Button>
      </div>
    </section>
  )
}