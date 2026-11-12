"use client"

import { useEffect, useState } from "react"
import { Keyboard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  captureEntryShortcut,
  DEFAULT_ENTRY_SHORTCUT_BY_CIF,
  DEFAULT_ENTRY_SHORTCUT_BY_NAME,
  entryShortcutAdvice,
  validateEntryShortcuts,
} from "@/lib/accounting/entry-shortcuts"
import { apiFetch, type SessionResponse } from "@/lib/api-client"

const LATER_KEY = "taxlyn-entry-shortcuts-later"

interface EntryShortcutPromptProps {
  open: boolean
  onSaved: () => Promise<void> | void
  onCapturingChange?: (capturing: boolean) => void
}

export function EntryShortcutPrompt({
  open,
  onSaved,
  onCapturingChange,
}: EntryShortcutPromptProps) {
  const [byName, setByName] = useState(DEFAULT_ENTRY_SHORTCUT_BY_NAME)
  const [byCif, setByCif] = useState(DEFAULT_ENTRY_SHORTCUT_BY_CIF)
  const [capturing, setCapturing] = useState<"name" | "cif" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [hiddenForNow, setHiddenForNow] = useState(false)

  useEffect(() => {
    if (!open) return
    try {
      setHiddenForNow(sessionStorage.getItem(LATER_KEY) === "1")
    } catch {
      setHiddenForNow(false)
    }
  }, [open])

  useEffect(() => {
    onCapturingChange?.(capturing !== null)
  }, [capturing, onCapturingChange])

  useEffect(() => {
    if (!capturing) return
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === "Escape") {
        setCapturing(null)
        return
      }
      const key = captureEntryShortcut(event)
      if (!key) return
      if (capturing === "name") setByName(key)
      else setByCif(key)
      setCapturing(null)
      setError(null)
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [capturing])

  if (!open || hiddenForNow) return null

  const nameAdvice = entryShortcutAdvice(byName)
  const cifAdvice = entryShortcutAdvice(byCif)

  const save = async () => {
    const validation = validateEntryShortcuts({ byName, byCif })
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch<SessionResponse>("/api/auth/entry-shortcuts", {
        method: "PATCH",
        body: JSON.stringify({ byName, byCif }),
      })
      try {
        sessionStorage.removeItem(LATER_KEY)
      } catch {
        /* el navegador puede bloquear sessionStorage */
      }
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las teclas.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-emerald-200 bg-white p-4 shadow-2xl"
      role="dialog"
      aria-labelledby="entry-shortcut-title"
    >
      <div className="mb-3 flex items-start gap-2">
        <Keyboard className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <h2 id="entry-shortcut-title" className="text-base font-semibold text-pine-900">
            Elige las teclas del asiento
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-graphite-600">
            Tú decides con qué tecla buscas una cuenta por nombre y con cuál buscas por CIF. F4 y
            F6 son solo la propuesta.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <ShortcutRow
          label="Buscar por nombre o cuenta"
          value={byName}
          listening={capturing === "name"}
          onListen={() => setCapturing("name")}
        />
        {nameAdvice ? <p className="text-xs text-amber-700">{nameAdvice}</p> : null}
        <ShortcutRow
          label="Buscar por número de CIF"
          value={byCif}
          listening={capturing === "cif"}
          onListen={() => setCapturing("cif")}
        />
        {cifAdvice ? <p className="text-xs text-amber-700">{cifAdvice}</p> : null}
      </div>

      {byName === "F8" || byCif === "F8" ? (
        <p className="mt-3 text-xs text-amber-700">
          Dentro del extracto, F7 y F8 cambian de cuenta. Si usas F8 para buscar, el extracto sigue en el botón EX.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            try {
              sessionStorage.setItem(LATER_KEY, "1")
            } catch {
              /* sigue pudiendo guardar las teclas */
            }
            setHiddenForNow(true)
          }}
        >
          Ahora no
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar estas teclas
        </Button>
      </div>
    </aside>
  )
}

function ShortcutRow({
  label,
  value,
  listening,
  onListen,
}: {
  label: string
  value: string
  listening: boolean
  onListen: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2">
      <span className="text-sm text-pine-900">{label}</span>
      <button
        type="button"
        onClick={onListen}
        className="min-w-[7.5rem] rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
      >
        {listening ? "Pulsa una tecla…" : value}
      </button>
    </div>
  )
}
