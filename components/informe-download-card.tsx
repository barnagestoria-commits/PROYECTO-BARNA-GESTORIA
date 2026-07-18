"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { ReportPreviewModal } from "@/components/report-preview-modal"
import { FiscalExportButtons, ReportExportButtons } from "@/components/report-export-buttons"
import type { SerializedPreview } from "@/components/report-preview-content"
import {
  CERTIFICADO_FISCAL_MODELS,
  downloadFiscalBundleZip,
  downloadListadosBundleZip,
  fetchReportPreview,
} from "@/lib/reports/download-client"
import { ANNUAL_SUMMARY_MODELS, FISCAL_MODEL_OPTIONS } from "@/lib/fiscal/fiscal-settings"
import type { ReportType } from "@/lib/reports/types"
import { Eye, FileText, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface InformeDownloadCardProps {
  title: string
  description: string
  icon: LucideIcon
  reportType?: ReportType
  certificadoSlug?: string
}

export function InformeDownloadCard({
  title,
  description,
  icon: Icon,
  reportType,
  certificadoSlug,
}: InformeDownloadCardProps) {
  const { activeCompany } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<SerializedPreview | null>(null)
  const [bundleLoading, setBundleLoading] = useState<"annual" | "trimestral" | "listados" | null>(null)
  const currentYear = new Date().getFullYear()

  const fiscalExport = certificadoSlug ? CERTIFICADO_FISCAL_MODELS[certificadoSlug] : undefined
  const isResumenAnual = certificadoSlug === "resumen-anual"
  const canExport = !!activeCompany && (!!reportType || !!fiscalExport || isResumenAnual)

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

  const handleBundleDownload = async (scope: "annual" | "trimestral" | "listados") => {
    if (!activeCompany) return
    setBundleLoading(scope)
    setError(null)
    try {
      if (scope === "listados") {
        await downloadListadosBundleZip(currentYear)
      } else {
        await downloadFiscalBundleZip(currentYear, scope)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el paquete ZIP.")
    } finally {
      setBundleLoading(null)
    }
  }

  return (
    <>
      <Card className="overflow-hidden border-emerald-200">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-start gap-2 text-lg leading-snug text-emerald-900">
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="break-words">{title}</span>
          </CardTitle>
          <CardDescription className="break-words text-pretty leading-relaxed">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
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

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Exportar para registro mercantil y Hacienda
            </p>

            {reportType ? (
              <ReportExportButtons reportType={reportType} year={currentYear} disabled={!canExport} />
            ) : isResumenAnual ? (
              <div className="space-y-4">
                {ANNUAL_SUMMARY_MODELS.map((modelId) => {
                  const model = FISCAL_MODEL_OPTIONS.find((item) => item.id === modelId)!
                  return (
                    <div key={modelId} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                      <p className="mb-2 text-sm font-medium text-emerald-900">{model.label} · anual</p>
                      <FiscalExportButtons
                        model={modelId}
                        quarter="anual"
                        year={currentYear}
                        disabled={!canExport}
                      />
                    </div>
                  )
                })}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canExport || !!bundleLoading}
                    className="gap-2 border-emerald-300"
                    onClick={() => handleBundleDownload("annual")}
                  >
                    {bundleLoading === "annual" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    ZIP anual completo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canExport || !!bundleLoading}
                    className="gap-2 border-emerald-300"
                    onClick={() => handleBundleDownload("trimestral")}
                  >
                    {bundleLoading === "trimestral" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    ZIP trimestral (.txt Hacienda)
                  </Button>
                </div>
              </div>
            ) : fiscalExport ? (
              <FiscalExportButtons
                model={fiscalExport.model}
                quarter={fiscalExport.quarter}
                year={currentYear}
                disabled={!canExport}
              />
            ) : (
              <p className="text-sm text-gray-500">Exportación no disponible para este informe.</p>
            )}

            {reportType && (
              <Button
                variant="default"
                size="sm"
                disabled={!canExport}
                className="gap-2 bg-emerald-800 hover:bg-emerald-700"
                onClick={handlePreview}
              >
                <Eye className="h-4 w-4" />
                Vista previa
              </Button>
            )}

            {reportType && (
              <Button
                variant="outline"
                size="sm"
                disabled={!canExport || !!bundleLoading}
                className="w-full gap-2 border-emerald-300 sm:w-auto"
                onClick={() => handleBundleDownload("listados")}
              >
                {bundleLoading === "listados" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Descargar todos los listados (ZIP)
              </Button>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-gray-500">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            PDF · Excel · CSV · TXT Hacienda (.txt) · ZIP con todos los formatos.
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
