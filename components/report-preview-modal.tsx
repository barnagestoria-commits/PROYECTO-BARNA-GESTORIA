"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ReportExportButtons } from "@/components/report-export-buttons"
import { ReportPreviewContent, type SerializedPreview } from "@/components/report-preview-content"
import type { ReportType } from "@/lib/reports/types"
import { Loader2, X } from "lucide-react"

interface ReportPreviewModalProps {
  open: boolean
  onClose: () => void
  reportType: ReportType
  preview: SerializedPreview | null
  isLoading: boolean
  error: string | null
  year: number
}

export function ReportPreviewModal({
  open,
  onClose,
  reportType,
  preview,
  isLoading,
  error,
  year,
}: ReportPreviewModalProps) {
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
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Vista previa</p>
            <p className="text-sm text-gray-500">Revisa el informe antes de exportar</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar vista previa">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando informe…
            </div>
          ) : error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : preview ? (
            <ReportPreviewContent preview={preview} />
          ) : null}
        </div>

        <div className="border-t bg-gray-50 px-4 py-3 sm:px-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">Exportar informe</p>
          <ReportExportButtons
            reportType={reportType}
            year={year}
            disabled={isLoading || !!error}
          />
        </div>
      </div>
    </div>
  )
}
