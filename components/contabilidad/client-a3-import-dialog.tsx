"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { A3CompanyImportPanel } from "@/components/import-export/a3-company-import-panel"

interface ClientA3ImportDialogProps {
  open: boolean
  companyId: string
  companyName: string
  companyCif?: string | null
  onClose: () => void
  onImported?: () => void
}

export function ClientA3ImportDialog({
  open,
  companyId,
  companyName,
  companyCif,
  onClose,
  onImported,
}: ClientA3ImportDialogProps) {
  useEffect(() => {
    if (!open) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-a3-import-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Importación contable
            </p>
            <h2 id="client-a3-import-title" className="text-lg font-semibold text-pine-900">
              Importar contabilidad (ZIP/TXT)
            </h2>
            <p className="mt-0.5 text-sm text-graphite-500">
              {companyName}
              {companyCif ? ` · NIF ${companyCif}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <p className="mb-4 text-sm text-graphite-600">
            Los asientos y subcuentas del fichero se importarán exclusivamente en la contabilidad
            de esta empresa cliente. Ningún dato se mezclará con otras empresas de la gestoría.
          </p>
          <A3CompanyImportPanel
            companyId={companyId}
            companyName={companyName}
            compact
            onSuccess={() => onImported?.()}
          />
        </div>
      </div>
    </div>
  )
}
