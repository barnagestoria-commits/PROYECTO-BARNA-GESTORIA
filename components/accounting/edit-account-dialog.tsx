"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import type { ReassignedAccount } from "@/lib/accounting/account-code-edit"

interface EditAccountDialogProps {
  open: boolean
  accountCode: string | null
  accountName?: string
  onClose: () => void
  onSaved: (account: ReassignedAccount) => void
}

export function EditAccountDialog({
  open,
  accountCode,
  accountName = "",
  onClose,
  onSaved,
}: EditAccountDialogProps) {
  const [cuenta, setCuenta] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !accountCode) return
    setCuenta(formatAccountCodeDisplay(accountCode))
    setName(accountName)
    setError(null)
  }, [accountCode, accountName, open])

  const handleSave = async () => {
    if (!accountCode) return
    setIsSaving(true)
    setError(null)
    try {
      const data = await apiFetch<{ success: true; account: ReassignedAccount }>(
        "/api/accounting/accounts/reassign",
        {
          method: "POST",
          body: JSON.stringify({
            fromAccountCode: accountCode,
            toAccountCode: cuenta,
            name,
          }),
        },
      )
      onSaved(data.account)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cuenta.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AccountingModal
      open={open}
      title="Editar cuenta"
      subtitle="El cambio se aplica al directorio, al extracto y a los asientos."
      onClose={onClose}
      className="max-w-md"
      layer="nested"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-800 hover:bg-pine-900"
            disabled={isSaving || !cuenta.trim()}
            onClick={() => void handleSave()}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-account-code">Cuenta</Label>
          <Input
            id="edit-account-code"
            value={cuenta}
            onChange={(event) => setCuenta(event.target.value)}
            className="font-mono"
            placeholder="430.2 · 430.0002"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-account-name">Nombre</Label>
          <Input
            id="edit-account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre de la cuenta o del tercero"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-graphite-500">
            Si escribes 430.2 se guarda como 430.0002 y se actualizan los asientos de esa cuenta.
          </p>
        )}
      </div>
    </AccountingModal>
  )
}
