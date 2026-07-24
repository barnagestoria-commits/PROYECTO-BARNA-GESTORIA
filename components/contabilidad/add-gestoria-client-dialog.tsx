"use client"

import { useEffect, useState } from "react"
import { Building2, Loader2, UserRound, Wand2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import type { CifLookupResult } from "@/lib/contacts/cif-lookup"
import type { GestoriaClientEntityType } from "@/lib/contabilidad/gestoria-client-service"
import { cn } from "@/lib/utils"

interface AddGestoriaClientDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (companyId: string) => void
}

const ENTITY_OPTIONS: {
  value: GestoriaClientEntityType
  label: string
  description: string
  icon: typeof Building2
}[] = [
  {
    value: "juridica",
    label: "Persona Jurídica",
    description: "Sociedad, SL, SA… · Imp. Sociedades",
    icon: Building2,
  },
  {
    value: "fisica",
    label: "Persona Física",
    description: "Autónomo o particular · IRPF",
    icon: UserRound,
  },
]

export function AddGestoriaClientDialog({
  open,
  onClose,
  onCreated,
}: AddGestoriaClientDialogProps) {
  const [entityType, setEntityType] = useState<GestoriaClientEntityType>("juridica")
  const [name, setName] = useState("")
  const [cif, setCif] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setEntityType("juridica")
    setName("")
    setCif("")
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  const handleLookupCif = async () => {
    const normalized = cif.trim()
    if (!normalized) {
      setError("Introduce un NIF o CIF antes de buscar datos fiscales.")
      return
    }

    setIsLookingUp(true)
    setError(null)

    try {
      const result = await apiFetch<{ success: true; data: CifLookupResult }>(
        `/api/lookup-cif?cif=${encodeURIComponent(normalized)}`,
      )
      setName(result.data.razonSocial)
      const first = normalized[0]?.toUpperCase()
      if (first && "XYZ0123456789".includes(first)) {
        setEntityType("fisica")
      } else if (first && "ABCFGJHNPQRSUVW".includes(first)) {
        setEntityType("juridica")
      }
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "No se encontraron datos automáticos. Introduce los datos manualmente.",
      )
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError("Indique el nombre o razón social del cliente.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const data = await apiFetch<{ success: true; company: { id: string } }>("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          cif: cif.trim() || undefined,
          entityType,
        }),
      })
      onCreated(data.company.id)
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el cliente de la gestoría.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-gestoria-client-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-sand-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
          <div>
            <h2 id="add-gestoria-client-title" className="text-lg font-bold text-pine-900">
              Agregar Persona Jurídica/Física
            </h2>
            <p className="text-sm text-graphite-500">
              Alta de empresa cliente en la cartera de la gestoría
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-graphite-500 hover:bg-sand-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-5">
          <fieldset className="mb-5">
            <legend className="mb-3 text-sm font-semibold text-pine-900">Tipo de cliente</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ENTITY_OPTIONS.map((option) => {
                const Icon = option.icon
                const selected = entityType === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEntityType(option.value)}
                    className={cn(
                      "flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all",
                      selected
                        ? "border-emerald-600 bg-emerald-50/80 shadow-sm"
                        : "border-sand-200 bg-white hover:border-sand-300 hover:bg-sand-50/50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mb-2 h-5 w-5",
                        selected ? "text-emerald-700" : "text-graphite-400",
                      )}
                    />
                    <span className="font-semibold text-pine-900">{option.label}</span>
                    <span className="mt-1 text-xs text-graphite-500">{option.description}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="grid gap-4">
            <div>
              <Label htmlFor="gestoria-client-cif">NIF / CIF</Label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="gestoria-client-cif"
                  value={cif}
                  onChange={(event) => setCif(event.target.value.toUpperCase())}
                  className="font-mono uppercase sm:flex-1"
                  placeholder="B12345678"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                  onClick={handleLookupCif}
                  disabled={isLookingUp || !cif.trim()}
                >
                  {isLookingUp ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Buscar NIF
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="gestoria-client-name">Nombre / Razón social *</Label>
              <Input
                id="gestoria-client-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-sand-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-800 hover:bg-pine-900"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Crear cliente"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
