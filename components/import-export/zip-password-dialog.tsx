"use client"

import { useEffect, useState } from "react"
import { Loader2, Lock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"

interface ZipPasswordDialogProps {
  open: boolean
  fileName?: string | null
  errorMessage?: string | null
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (password: string) => void
}

export function ZipPasswordDialog({
  open,
  fileName,
  errorMessage,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: ZipPasswordDialogProps) {
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (!open) {
      setPassword("")
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) onCancel()
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open, isSubmitting, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zip-password-title"
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b px-4 py-3 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-800">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 id="zip-password-title" className="text-lg font-semibold text-pine-900">
                ZIP protegido con contraseña
              </h2>
              <p className="mt-0.5 text-sm text-graphite-500">
                {fileName
                  ? `Introduce la contraseña del export A3 para abrir «${fileName}».`
                  : "Introduce la contraseña del export A3 para continuar."}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form
          className="space-y-4 px-4 py-5 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (!password.trim() || isSubmitting) return
            onSubmit(password)
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="zip-password">Contraseña del ZIP</Label>
            <PasswordInput
              id="zip-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña del export A3"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          <p className="text-xs text-graphite-500">
            Es la misma contraseña que configuraste en A3 al exportar con «Proteger con contraseña».
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={isSubmitting || !password.trim()}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desbloquear y continuar
            </Button>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
