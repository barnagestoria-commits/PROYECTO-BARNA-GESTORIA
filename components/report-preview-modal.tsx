"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ReportPreviewContent, type SerializedPreview } from "@/components/report-preview-content"
import { downloadReportExcel, downloadReportPdf } from "@/lib/reports/download-client"
import type { ReportType } from "@/lib/reports/types"
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react"

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
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null)

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

  const handleDownload = async (format: "pdf" | "excel") => {
    setDownloading(format)
    try {
      if (format === "pdf") {
        await downloadReportPdf(reportType, year)
      } else {
        await downloadReportExcel(reportType, year)
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo descargar el informe.")
    } finally {
      setDownloading(null)
    }
  }

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!!downloading || isLoading || !!error}
              onClick={() => handleDownload("pdf")}
              className="hidden gap-2 sm:inline-flex"
            >
              {downloading === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!!downloading || isLoading || !!error}
              onClick={() => handleDownload("excel")}
              className="hidden gap-2 sm:inline-flex"
            >
              {downloading === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar vista previa">
              <X className="h-5 w-5" />
            </Button>
          </div>
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

        <div className="flex flex-wrap gap-2 border-t bg-gray-50 px-4 py-3 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            disabled={!!downloading || isLoading || !!error}
            onClick={() => handleDownload("pdf")}
          >
            {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            disabled={!!downloading || isLoading || !!error}
            onClick={() => handleDownload("excel")}
          >
            {downloading === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Descargar Excel
          </Button>
        </div>
      </div>
    </div>
  )
}
