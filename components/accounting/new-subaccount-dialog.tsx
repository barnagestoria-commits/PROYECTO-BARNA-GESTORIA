"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import type { ThirdPartyResolution } from "@/lib/accounting/third-party-types"
import type { LedgerSubaccountResolution } from "@/lib/accounting/ledger-subaccount-types"
import {
  isThirdPartyNewAccountPrefix,
  resolveAccountParentCode,
  THIRD_PARTY_PREFIX_CONFIG,
  type NewAccountPrefix,
} from "@/lib/accounting/new-account-prefix"

export type AccountCreationResult =
  | { kind: "third-party"; resolution: ThirdPartyResolution }
  | { kind: "ledger"; resolution: LedgerSubaccountResolution }

interface NewSubaccountDialogProps {
  open: boolean
  prefix: NewAccountPrefix | null
  onClose: () => void
  onCreated: (result: AccountCreationResult) => void
}

export function NewSubaccountDialog({
  open,
  prefix,
  onClose,
  onCreated,
}: NewSubaccountDialogProps) {
  const [nif, setNif] = useState("")
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [previewAccount, setPreviewAccount] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const meta = prefix ? resolveAccountParentCode(prefix) : null
  const isThirdParty = prefix ? isThirdPartyNewAccountPrefix(prefix) : false
  const thirdPartyConfig =
    prefix && isThirdPartyNewAccountPrefix(prefix) ? THIRD_PARTY_PREFIX_CONFIG[prefix] : null

  useEffect(() => {
    if (!open || !prefix) {
      setPreviewAccount(null)
      return
    }

    if (isThirdParty) {
      if (!nif.trim()) {
        setPreviewAccount(null)
        return
      }

      const timer = window.setTimeout(async () => {
        try {
          const data = await apiFetch<{ success: true; resolution: ThirdPartyResolution }>(
            `/api/accounting/third-parties/resolve?prefix=${prefix}&cif=${encodeURIComponent(nif)}&name=${encodeURIComponent(name)}`,
          )
          setPreviewAccount(data.resolution.formattedAccountCode)
          setError(null)
        } catch {
          setPreviewAccount(null)
        }
      }, 350)

      return () => window.clearTimeout(timer)
    }

    if (!name.trim()) {
      setPreviewAccount(null)
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const data = await apiFetch<{ success: true; resolution: LedgerSubaccountResolution }>(
          `/api/accounting/ledger-subaccounts/resolve?parentCode=${prefix}&name=${encodeURIComponent(name)}`,
        )
        setPreviewAccount(data.resolution.formattedAccountCode)
        setError(null)
      } catch {
        setPreviewAccount(null)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [open, prefix, isThirdParty, nif, name])

  useEffect(() => {
    if (!open) {
      setNif("")
      setName("")
      setAddress("")
      setPhone("")
      setEmail("")
      setNotes("")
      setPreviewAccount(null)
      setError(null)
    }
  }, [open])

  const handleCreate = async () => {
    if (!prefix || !meta) return

    setIsLoading(true)
    setError(null)

    try {
      if (isThirdParty) {
        const data = await apiFetch<{ success: true; resolution: ThirdPartyResolution }>(
          "/api/accounting/third-parties",
          {
            method: "POST",
            body: JSON.stringify({
              accountPrefix: prefix,
              cif: nif,
              name,
              address,
              phone,
              email,
              notes,
            }),
          },
        )
        onCreated({ kind: "third-party", resolution: data.resolution })
      } else {
        const data = await apiFetch<{ success: true; resolution: LedgerSubaccountResolution }>(
          "/api/accounting/ledger-subaccounts",
          {
            method: "POST",
            body: JSON.stringify({
              parentCode: prefix,
              name,
              address,
              phone,
              email,
              notes,
            }),
          },
        )
        onCreated({ kind: "ledger", resolution: data.resolution })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la subcuenta.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!meta || !prefix) return null

  const canSubmit = isThirdParty ? Boolean(nif.trim() && name.trim()) : Boolean(name.trim())

  return (
    <AccountingModal
      open={open}
      title={`Alta de subcuenta ${prefix}+`}
      subtitle={
        isThirdParty
          ? thirdPartyConfig?.description
          : `Nueva subcuenta de ${meta.label}. Indica el nombre descriptivo (p. ej. Multas y sanciones).`
      }
      onClose={onClose}
      className="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-800 hover:bg-pine-900"
            disabled={!canSubmit || isLoading}
            onClick={handleCreate}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear y asignar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <strong>{isThirdParty ? thirdPartyConfig?.label : meta.label}</strong>
          {previewAccount ? (
            <span>
              {" "}
              · Cuenta prevista: <span className="font-mono">{previewAccount}</span>
            </span>
          ) : (
            <span>
              {" "}
              · {isThirdParty ? "Introduce NIF y nombre" : "Introduce el nombre"} para calcular la
              subcuenta.
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {isThirdParty && (
            <div className="space-y-1.5">
              <Label htmlFor="new-account-nif">N.I.F. / C.I.F.</Label>
              <Input
                id="new-account-nif"
                value={nif}
                onChange={(event) => setNif(event.target.value.toUpperCase())}
                className="font-mono uppercase"
                autoFocus
              />
            </div>
          )}
          <div className={`space-y-1.5 ${isThirdParty ? "sm:col-span-2" : "sm:col-span-2"}`}>
            <Label htmlFor="new-account-name">
              {isThirdParty ? "Razón social / Nombre" : "Nombre de la subcuenta"}
            </Label>
            <Input
              id="new-account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={isThirdParty ? undefined : "Multas y sanciones"}
              autoFocus={!isThirdParty}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="new-account-address">Domicilio</Label>
            <Input
              id="new-account-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-account-phone">Teléfono</Label>
            <Input
              id="new-account-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-account-email">Email</Label>
            <Input
              id="new-account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="new-account-notes">Observaciones</Label>
            <Textarea
              id="new-account-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </AccountingModal>
  )
}
