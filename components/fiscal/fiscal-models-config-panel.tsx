"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import {
  FISCAL_MODEL_OPTIONS,
  settingsKeyForModel,
  type CompanyFiscalSettingsDto,
} from "@/lib/fiscal/fiscal-settings"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"
import { cn } from "@/lib/utils"

interface FiscalModelsConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
  className?: string
}

export function FiscalModelsConfigPanel({
  open,
  onOpenChange,
  onSaved,
  className,
}: FiscalModelsConfigPanelProps) {
  const [settings, setSettings] = useState<CompanyFiscalSettingsDto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ success: true; settings: CompanyFiscalSettingsDto }>(
        "/api/fiscal/settings",
      )
      setSettings(data.settings)
    } catch {
      setSettings(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadSettings()
      setMessage(null)
    }
  }, [loadSettings, open])

  const toggleModel = async (model: FiscalModelId, enabled: boolean) => {
    if (!settings) return
    setIsSaving(true)
    setMessage(null)
    try {
      const data = await apiFetch<{ success: true; settings: CompanyFiscalSettingsDto }>(
        "/api/fiscal/settings",
        {
          method: "PATCH",
          body: JSON.stringify({ [settingsKeyForModel(model)]: enabled }),
        },
      )
      setSettings(data.settings)
      onSaved?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className={cn("rounded-lg border border-emerald-200 bg-emerald-50/40 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Settings2 className="h-4 w-4" />
            Modelos visibles en la panorámica
          </p>
          <p className="mt-1 text-xs text-graphite-600">
            Marca qué impuestos deben aparecer en la matriz trimestral de esta empresa.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-graphite-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando configuración…
        </div>
      ) : settings ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {FISCAL_MODEL_OPTIONS.map((model) => {
            const enabled = settings[settingsKeyForModel(model.id)]
            return (
              <label
                key={model.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-white bg-white/80 px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={enabled}
                  disabled={isSaving}
                  onChange={(event) => void toggleModel(model.id, event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-graphite-900">{model.label}</span>
                  <span className="block text-xs text-graphite-500">{model.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-red-700">No se pudo cargar la configuración fiscal.</p>
      )}

      {message && <p className="mt-3 text-xs text-red-700">{message}</p>}
    </div>
  )
}

interface FiscalModelsConfigButtonProps {
  onSaved?: () => void
}

export function FiscalModelsConfigButton({ onSaved }: FiscalModelsConfigButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
        <Settings2 className="mr-2 h-4 w-4" />
        Configurar modelos
      </Button>
      <FiscalModelsConfigPanel
        open={open}
        onOpenChange={setOpen}
        onSaved={() => {
          onSaved?.()
        }}
      />
    </div>
  )
}
