"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { ReportPreviewModal } from "@/components/report-preview-modal"
import type { SerializedPreview } from "@/components/report-preview-content"
import {
  downloadReportExcel,
  downloadReportPdf,
  fetchReportPreview,
} from "@/lib/reports/download-client"
import type { ReportType } from "@/lib/reports/types"
import { Download, Eye, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface InformeDownloadCardProps {
  title: string
  description: string
  icon: LucideIcon
  reportType?: ReportType
}

export function InformeDownloadCard({
  title,
  description,
  icon: Icon,
  reportType,
}: InformeDownloadCardProps) {
  const { activeCompany } = useAuth()
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<SerializedPreview | null>(null)
  const currentYear = new Date().getFullYear()

  const handleDownloadPdf = async () => {
    if (!activeCompany || !reportType) return
    setDownloading("pdf")
    setError(null)
    try {
      await downloadReportPdf(reportType, currentYear)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el PDF.")
    } finally {
      setDownloading(null)
    }
  }

  const handleDownloadExcel = async () => {
    if (!activeCompany || !reportType) return
    setDownloading("excel")
    setError(null)
    try {
      await downloadReportExcel(reportType, currentYear)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el Excel.")
    } finally {
      setDownloading(null)
    }
  }

  const handlePreview = async () => {
    if (!activeCompany || !reportType) return

    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)

    try {
      const preview = await fetchReportPreview(reportType, currentYear)
      setPreviewData(preview)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "No se pudo cargar la vista previa.")
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <>
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeCompany ? (
            <p className="text-sm text-amber-700">Selecciona una empresa activa para generar el informe.</p>
          ) : (
            <p className="text-sm text-gray-600">
              Empresa: <span className="font-medium text-gray-900">{activeCompany.name}</span>
              {" · "}
              <span className="text-gray-500">Ejercicio {currentYear}</span>
            </p>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={!activeCompany || !reportType || downloading !== null}
              className="gap-2 bg-emerald-800 hover:bg-emerald-700"
              onClick={handlePreview}
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeCompany || !reportType || downloading !== null}
              className="gap-2 border-emerald-200 hover:bg-emerald-50"
              onClick={handleDownloadPdf}
            >
              {downloading === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeCompany || !reportType || downloading !== null}
              className="gap-2 border-emerald-200 hover:bg-emerald-50"
              onClick={handleDownloadExcel}
            >
              {downloading === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Exportar Excel
            </Button>
          </div>

          <p className="flex items-center gap-2 text-xs text-gray-500">
            <FileText className="h-3.5 w-3.5" />
            Datos calculados en tiempo real desde los asientos del libro diario.
          </p>
        </CardContent>
      </Card>

      {reportType && (
        <ReportPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          reportType={reportType}
          preview={previewData}
          isLoading={previewLoading}
          error={previewError}
          year={currentYear}
        />
      )}
    </>
  )
}

export function InformePageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin" />
      Preparando {label}…
    </div>
  )
}
