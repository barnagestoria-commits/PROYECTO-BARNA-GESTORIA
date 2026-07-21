"use client"

import { useEffect, useState } from "react"
import { Building2, Handshake, Truck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  PAYMENT_METHOD_LABELS,
  suggestAccountCodes,
} from "@/lib/contacts/mock-contacts"
import type { Contact, ContactType, NewContactFormData, PaymentMethod } from "@/lib/contacts/types"

interface NewContactModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: NewContactFormData) => void
  existingContacts: Contact[]
  initialData: NewContactFormData
  mode?: "create" | "edit"
}

const TYPE_OPTIONS: {
  value: ContactType
  label: string
  description: string
  icon: typeof Building2
}[] = [
  {
    value: "cliente",
    label: "Cliente",
    description: "Cuenta 430 · facturas emitidas",
    icon: Building2,
  },
  {
    value: "proveedor",
    label: "Proveedor",
    description: "Cuenta 400 · facturas recibidas",
    icon: Truck,
  },
  {
    value: "ambos",
    label: "Ambos",
    description: "Cliente y proveedor a la vez",
    icon: Handshake,
  },
]

export function NewContactModal({
  open,
  onClose,
  onSubmit,
  existingContacts,
  initialData,
  mode = "create",
}: NewContactModalProps) {
  const [form, setForm] = useState<NewContactFormData>(initialData)

  useEffect(() => {
    if (open) setForm(initialData)
  }, [open, initialData])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  const handleTypeChange = (tipo: ContactType) => {
    const accounts = suggestAccountCodes(tipo, existingContacts)
    setForm((prev) => ({
      ...prev,
      tipo,
      cuentaCliente: accounts.cuentaCliente,
      cuentaProveedor: accounts.cuentaProveedor,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.razonSocial.trim() || !form.nif.trim()) return
    onSubmit(form)
  }

  const showClienteAccount = form.tipo === "cliente" || form.tipo === "ambos"
  const showProveedorAccount = form.tipo === "proveedor" || form.tipo === "ambos"

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-sand-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="contact-modal-title" className="text-lg font-bold text-pine-900">
              {mode === "edit" ? "Editar contacto" : "Nuevo contacto"}
            </h2>
            <p className="text-sm text-graphite-500">Alta de cliente, proveedor o ambos</p>
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

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-5 sm:px-6">
          <fieldset className="mb-6">
            <legend className="mb-3 text-sm font-semibold text-pine-900">Tipo de contacto</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {TYPE_OPTIONS.map((option) => {
                const Icon = option.icon
                const selected = form.tipo === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleTypeChange(option.value)}
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

          {(showClienteAccount || showProveedorAccount) && (
            <div className="mb-6 grid gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-2">
              <p className="sm:col-span-2 text-xs font-medium text-emerald-800">
                Cuentas contables sugeridas automáticamente
              </p>
              {showClienteAccount && (
                <div>
                  <Label htmlFor="cuentaCliente" className="text-graphite-600">
                    Cuenta cliente (430)
                  </Label>
                  <Input
                    id="cuentaCliente"
                    value={form.cuentaCliente}
                    onChange={(e) => setForm((p) => ({ ...p, cuentaCliente: e.target.value }))}
                    className="mt-1 font-mono"
                  />
                </div>
              )}
              {showProveedorAccount && (
                <div>
                  <Label htmlFor="cuentaProveedor" className="text-graphite-600">
                    Cuenta proveedor (400)
                  </Label>
                  <Input
                    id="cuentaProveedor"
                    value={form.cuentaProveedor}
                    onChange={(e) => setForm((p) => ({ ...p, cuentaProveedor: e.target.value }))}
                    className="mt-1 font-mono"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="razonSocial">Razón social *</Label>
              <Input
                id="razonSocial"
                value={form.razonSocial}
                onChange={(e) => setForm((p) => ({ ...p, razonSocial: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="nif">NIF / CIF *</Label>
              <Input
                id="nif"
                value={form.nif}
                onChange={(e) => setForm((p) => ({ ...p, nif: e.target.value.toUpperCase() }))}
                className="mt-1 font-mono uppercase"
                required
              />
            </div>
            <div>
              <Label htmlFor="formaPago">Forma de pago habitual</Label>
              <select
                id="formaPago"
                value={form.formaPago}
                onChange={(e) =>
                  setForm((p) => ({ ...p, formaPago: e.target.value as PaymentMethod }))
                }
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((key) => (
                  <option key={key} value={key}>
                    {PAYMENT_METHOD_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="direccionFiscal">Dirección fiscal</Label>
              <Input
                id="direccionFiscal"
                value={form.direccionFiscal}
                onChange={(e) => setForm((p) => ({ ...p, direccionFiscal: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={form.iban}
                onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
                className="mt-1 font-mono"
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-sand-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-800 hover:bg-pine-900">
              {mode === "edit" ? "Guardar cambios" : "Crear contacto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function contactToForm(contact: Contact): NewContactFormData {
  return {
    razonSocial: contact.razonSocial,
    nif: contact.nif,
    tipo: contact.tipo,
    cuentaCliente: contact.cuentaCliente ?? "",
    cuentaProveedor: contact.cuentaProveedor ?? "",
    email: contact.email,
    telefono: contact.telefono,
    direccionFiscal: contact.direccionFiscal,
    iban: contact.iban ?? "",
    formaPago: contact.formaPago,
  }
}

export { contactToForm }
