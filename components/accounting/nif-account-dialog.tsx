"use client"

import { useState } from "react"
import type { ThirdPartyType } from "@prisma/client"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { AccountingModal } from "@/components/accounting/accounting-modal"
import { apiFetch } from "@/lib/api-client"
import type { ThirdPartyResolution } from "@/lib/accounting/third-party-types"

interface NifAccountDialogProps {
  open: boolean
  onClose: () => void
  thirdPartyType: ThirdPartyType
  onResolved: (resolution: ThirdPartyResolution) => void
}

export function NifAccountDialog({
  open,
  onClose,
  thirdPartyType,
  onResolved,
}: NifAccountDialogProps) {
  const [nif, setNif] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleResolve = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiFetch<{ success: true; resolution: ThirdPartyResolution }>(
        `/api/accounting/third-parties/resolve?type=${thirdPartyType}&cif=${encodeURIComponent(nif)}&name=${encodeURIComponent(name)}`,
      )
      onResolved(data.resolution)
      onClose()
      setNif("")
      setName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver el NIF.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AccountingModal
      open={open}
      title="Buscar cuenta por NIF"
      subtitle="F6 · Asigna la subcuenta del tercero al asiento"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-emerald-800 hover:bg-pine-900"
            disabled={!nif.trim() || isLoading}
            onClick={handleResolve}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar cuenta"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nif-lookup">N.I.F. / C.I.F.</Label>
          <Input
            id="nif-lookup"
            value={nif}
            onChange={(event) => setNif(event.target.value.toUpperCase())}
            placeholder="B12345678"
            className="font-mono uppercase"
            autoFocus
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nif-name">
            {thirdPartyType === "CLIENTE" ? "Cliente" : "Proveedor"}
          </Label>
          <Input
            id="nif-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del tercero"
          />
        </div>
        {error && (
          <p className="sm:col-span-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </AccountingModal>
  )
}
