"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  createOcrShortcut,
  DEFAULT_OCR_SETTINGS,
  OCR_COMMAND_ACTIONS,
  shortcutAdvice,
  shortcutFromKeyboardEvent,
  validateOcrShortcuts,
  type OcrCommandAction,
  type OcrShortcutCommand,
  type OcrWorkspaceSettings,
} from "@/lib/ocr/ocr-settings"

interface OcrSettingsDialogProps {
  open: boolean
  saving?: boolean
  settings: OcrWorkspaceSettings
  onClose: () => void
  onSave: (settings: OcrWorkspaceSettings) => Promise<void> | void
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
  recommended,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  description: string
  recommended?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-sand-200 bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-700"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-pine-900">
          {title}
          {recommended ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Recomendado
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-graphite-500">{description}</span>
      </span>
    </label>
  )
}

export function OcrSettingsDialog({
  open,
  saving = false,
  settings,
  onClose,
  onSave,
}: OcrSettingsDialogProps) {
  const [draft, setDraft] = useState<OcrWorkspaceSettings>(settings)
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setCapturingId(null)
      setError(null)
    }
  }, [open, settings])

  useEffect(() => {
    if (!open || !capturingId) return

    const onKeyDown = (event: KeyboardEvent) => {
      const key = shortcutFromKeyboardEvent(event)
      if (!key) return
      event.preventDefault()
      event.stopPropagation()
      setDraft((prev) => ({
        ...prev,
        shortcuts: prev.shortcuts.map((item) => (item.id === capturingId ? { ...item, key } : item)),
      }))
      setCapturingId(null)
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [open, capturingId])

  const updateShortcut = (id: string, patch: Partial<OcrShortcutCommand>) => {
    setDraft((prev) => ({
      ...prev,
      shortcuts: prev.shortcuts.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  const handleSave = async () => {
    const filled = {
      ...draft,
      shortcuts: draft.shortcuts.filter((item) => item.key.trim()),
    }
    if (filled.shortcuts.length === 0) {
      filled.shortcuts = [...DEFAULT_OCR_SETTINGS.shortcuts]
    }
    const shortcutError = validateOcrShortcuts(filled.shortcuts)
    if (shortcutError) {
      setError(shortcutError)
      return
    }
    setError(null)
    await onSave(filled)
  }

  const riskyAdvice = draft.shortcuts
    .map((item) => shortcutAdvice(item.key))
    .filter((item): item is string => Boolean(item))

  return (
    <AccountingModal
      open={open}
      title="Configurar OCR"
      subtitle="Atajos, duplicadas y controles de esta empresa. No cambia facturas ya contabilizadas."
      onClose={onClose}
      className="max-w-3xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-700 hover:bg-emerald-800"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Guardando…" : "Guardar configuración"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Hasta pulsar Confirmar no se crea cuenta ni asiento. Deja activas las protecciones de
              duplicadas y NIF: evitan IVA duplicado y facturas sin tercero identificable.
            </span>
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-pine-900">Control al confirmar</h3>
            <p className="text-xs text-graphite-500">
              Aplican a compras y a ventas. Puedes relajarlas en tickets sin NIF, pero no lo
              recomendamos para facturas formales.
            </p>
          </div>
          <ToggleRow
            checked={draft.blockDuplicates}
            onChange={(blockDuplicates) => setDraft((prev) => ({ ...prev, blockDuplicates }))}
            title="Detectar facturas duplicadas"
            recommended
            description="Si ya hay un asiento con el mismo NIF y número, avisa y no confirma hasta que lo autorices."
          />
          <ToggleRow
            checked={draft.requireCif}
            onChange={(requireCif) => setDraft((prev) => ({ ...prev, requireCif }))}
            title="Exigir NIF/CIF para confirmar"
            recommended
            description="Impide contabilizar sin identificador fiscal. Desactívalo solo para tickets de caja sin NIF."
          />
          <ToggleRow
            checked={draft.requireTotalsMatch}
            onChange={(requireTotalsMatch) => setDraft((prev) => ({ ...prev, requireTotalsMatch }))}
            title="Exigir que los importes cuadren"
            description="No deja confirmar si el total calculado no coincide con el de la factura. Útil para no descuadrar el diario."
          />
          <ToggleRow
            checked={draft.isolateCurrentInvoice}
            onChange={(isolateCurrentInvoice) =>
              setDraft((prev) => ({ ...prev, isolateCurrentInvoice }))
            }
            title="Mostrar solo la factura actual"
            recommended
            description="En un PDF con varios tickets, el visor enseña únicamente la que estás validando."
          />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-pine-900">Comandos de teclado</h3>
              <p className="text-xs text-graphite-500">
                Crea los tuyos. Pulsa «Capturar» y luego la tecla (F4–F10 o Alt+letra).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  shortcuts: [...DEFAULT_OCR_SETTINGS.shortcuts],
                }))
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar F4 / F12
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-sand-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-sand-50 text-left text-xs uppercase text-graphite-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="px-3 py-2 font-medium">Tecla</th>
                  <th className="w-28 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {draft.shortcuts.map((item) => (
                  <tr key={item.id} className="border-t border-sand-200">
                    <td className="px-3 py-2">
                      <select
                        value={item.action}
                        onChange={(event) =>
                          updateShortcut(item.id, { action: event.target.value as OcrCommandAction })
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {OCR_COMMAND_ACTIONS.map((action) => (
                          <option key={action.action} value={action.action}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setCapturingId(item.id)}
                        className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 font-mono text-sm"
                      >
                        {capturingId === item.id
                          ? "Pulsa una tecla…"
                          : item.key || "Sin asignar"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            shortcuts: prev.shortcuts.filter((row) => row.id !== item.id),
                          }))
                        }
                        disabled={draft.shortcuts.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                shortcuts: [...prev.shortcuts, createOcrShortcut("skip")],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            Añadir comando
          </Button>

          {riskyAdvice.length > 0 ? (
            <div className="space-y-1 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              {riskyAdvice.map((advice) => (
                <p key={advice}>{advice}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-graphite-500">
              Consejo: F4 confirmar y F8 saltar evitan el conflicto de F12 con el navegador.
            </p>
          )}
        </section>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Label className="sr-only">Configuración OCR</Label>
      </div>
    </AccountingModal>
  )
}
