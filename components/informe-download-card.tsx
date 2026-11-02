"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { ReportPreviewModal } from "@/components/report-preview-modal"
import { ReportExportButtons } from "@/components/report-export-buttons"
import { FiscalPresentationChoicePanel } from "@/components/fiscal/fiscal-presentation-choice"
import type { SerializedPreview } from "@/components/report-preview-content"
import {
  CERTIFICADO_FISCAL_MODELS,
  downloadFiscalBundleZip,
  downloadListadosBundleZip,
  fetchReportPreview,
} from "@/lib/reports/download-client"
import { ANNUAL_SUMMARY_MODELS, FISCAL_MODEL_OPTIONS } from "@/lib/fiscal/fiscal-settings"
import type { ReportType } from "@/lib/reports/types"
import { apiFetch } from "@/lib/api-client"
import { Eye, FileText, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { AccountDetailLevelPicker } from "@/components/accounting/account-detail-level-picker"
import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import type { CostCenterListing, ReportBreakdown } from "@/lib/reports/statement-layout"

interface CostCenterOption {
  id: string
  code: string
  name: string
}

const MONTH_OPTIONS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const BREAKDOWN_OPTIONS: Array<{ id: ReportBreakdown; label: string }> = [
  { id: "anual", label: "Anual" },
  { id: "trimestral", label: "Trimestral" },
  { id: "mensual", label: "Mensual" },
]

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
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [selectedCostCenterId, setSelectedCostCenterId] = useState("")
  const [costCenterListing, setCostCenterListing] = useState<CostCenterListing>("consolidado")
  const [detailLevel, setDetailLevel] = useState<GestoriaAccountDetailLevel>("SUBCUENTAS")
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [compareYears, setCompareYears] = useState<number[]>([thisYear - 1])
  const [breakdown, setBreakdown] = useState<ReportBreakdown>("anual")
  const [fromMonth, setFromMonth] = useState(1)
  const [toMonth, setToMonth] = useState(12)
  const yearOptions = Array.from({ length: 8 }, (_, index) => thisYear - index)

  const supportsCostCenterFilter = reportType === "balance" || reportType === "pyg"
  const supportsComparison = reportType === "balance" || reportType === "pyg"
  const supportsDetailLevel = reportType === "balance" || reportType === "pyg" || reportType === "sumas-saldos"
  const selectedCompareYears = supportsComparison ? compareYears.filter((value) => value !== year).slice(0, 5) : []
  const listing: CostCenterListing =
    supportsCostCenterFilter && costCenters.length > 0 ? costCenterListing : "consolidado"
  const activeListing = listing === "centro" && !selectedCostCenterId ? "consolidado" : listing
  const reportOptions = {
    compareYear: selectedCompareYears[0],
    compareYears: selectedCompareYears,
    breakdown: activeListing === "por-centros" ? "anual" : breakdown,
    fromMonth,
    toMonth,
    costCenterListing: activeListing,
    costCenterId: activeListing === "centro" ? selectedCostCenterId : undefined,
    detailLevel: supportsDetailLevel ? detailLevel : undefined,
  }

  useEffect(() => {
    if (!activeCompany?.id || !supportsCostCenterFilter) {
      setCostCenters([])
      return
    }
    apiFetch<{ success: true; costCenters: CostCenterOption[] }>("/api/cost-centers")
      .then((data) => setCostCenters(data.costCenters))
      .catch(() => setCostCenters([]))
  }, [activeCompany?.id, supportsCostCenterFilter])

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
      const preview = await fetchReportPreview(reportType, year, reportOptions)
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
        await downloadListadosBundleZip(year, reportOptions)
      } else {
        await downloadFiscalBundleZip(year, scope)
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
              <span className="text-gray-500">
                Ejercicio {year}
                {selectedCompareYears.length > 0 ? ` · comparativa ${selectedCompareYears.join(", ")}` : ""}
              </span>
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
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="report-year" className="text-xs text-graphite-600">
                      Ejercicio
                    </Label>
                    <select
                      id="report-year"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={year}
                      onChange={(event) => {
                        const nextYear = Number(event.target.value)
                        setYear(nextYear)
                        setCompareYears((current) => current.filter((value) => value !== nextYear))
                      }}
                    >
                      {yearOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {supportsComparison ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="report-from-month" className="text-xs text-graphite-600">
                          Desde
                        </Label>
                        <select
                          id="report-from-month"
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={fromMonth}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            setFromMonth(next)
                            if (next > toMonth) setToMonth(next)
                          }}
                        >
                          {MONTH_OPTIONS.map((label, index) => (
                            <option key={label} value={index + 1}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="report-to-month" className="text-xs text-graphite-600">
                          Hasta
                        </Label>
                        <select
                          id="report-to-month"
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={toMonth}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            setToMonth(next)
                            if (next < fromMonth) setFromMonth(next)
                          }}
                        >
                          {MONTH_OPTIONS.map((label, index) => (
                            <option key={label} value={index + 1}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : null}
                </div>
                {supportsComparison ? (
                  <>
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Desglose
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {BREAKDOWN_OPTIONS.map((option) => {
                          const disabled = activeListing === "por-centros" && option.id !== "anual"
                          const selected = (activeListing === "por-centros" ? "anual" : breakdown) === option.id
                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={disabled}
                              aria-pressed={selected}
                              onClick={() => setBreakdown(option.id)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                                selected
                                  ? "border-emerald-700 bg-emerald-800 text-white"
                                  : "border-sand-300 bg-white text-graphite-700 hover:border-emerald-400"
                              }`}
                            >
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-graphite-500">
                        {activeListing === "por-centros"
                          ? "Por centros usa el periodo elegido, con una columna por centro, el total y el porcentaje de cada ejercicio comparado."
                          : breakdown === "trimestral"
                            ? "El balance acumula el saldo hasta el cierre de cada trimestre. La cuenta de resultados suma el movimiento del trimestre. Con un ejercicio comparado, cada trimestre lleva su porcentaje."
                            : breakdown === "mensual"
                              ? "Mes a mes dentro del periodo. Los ejercicios comparados salen al cierre, con el porcentaje de cambio."
                              : "Una columna por ejercicio. Entre el ejercicio y cada comparado va el porcentaje de cambio."}
                      </p>
                    </fieldset>
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Ejercicios a comparar
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {yearOptions
                          .filter((option) => option !== year)
                          .map((option) => {
                            const selected = selectedCompareYears.includes(option)
                            return (
                              <button
                                key={option}
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  setCompareYears((current) =>
                                    current.includes(option)
                                      ? current.filter((value) => value !== option)
                                      : [...current, option].sort((a, b) => b - a).slice(0, 5),
                                  )
                                }
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                  selected
                                    ? "border-emerald-700 bg-emerald-800 text-white"
                                    : "border-sand-300 bg-white text-graphite-700 hover:border-emerald-400"
                                }`}
                              >
                                {option}
                              </button>
                            )
                          })}
                      </div>
                      <p className="text-xs text-graphite-500">
                        Puedes marcar varios. El porcentaje compara el ejercicio {year} con cada uno de ellos.
                      </p>
                    </fieldset>
                  </>
                ) : null}
                {supportsDetailLevel && (
                  <AccountDetailLevelPicker value={detailLevel} onChange={setDetailLevel} />
                )}
                {supportsCostCenterFilter && costCenters.length > 0 && (
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      Centros de coste
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["consolidado", "Consolidado"],
                          ["centro", "Un centro"],
                          ["por-centros", "Por centros y total"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={costCenterListing === id}
                          onClick={() => setCostCenterListing(id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            costCenterListing === id
                              ? "border-emerald-700 bg-emerald-800 text-white"
                              : "border-sand-300 bg-white text-graphite-700 hover:border-emerald-400"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {costCenterListing === "centro" ? (
                      <select
                        id="report-cost-center"
                        aria-label="Centro de coste"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedCostCenterId}
                        onChange={(event) => setSelectedCostCenterId(event.target.value)}
                      >
                        <option value="">Elige un centro</option>
                        {costCenters.map((center) => (
                          <option key={center.id} value={center.id}>
                            {center.code} · {center.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-graphite-500">
                        {costCenterListing === "por-centros"
                          ? "Una columna por centro, el importe sin centro si queda algo sin repartir, el total y el porcentaje de los ejercicios comparados."
                          : "Todo el movimiento de la empresa, sin separar centros."}
                      </p>
                    )}
                  </fieldset>
                )}
                <ReportExportButtons
                  reportType={reportType}
                  year={year}
                  compareYear={reportOptions.compareYear}
                  compareYears={reportOptions.compareYears}
                  breakdown={reportOptions.breakdown}
                  fromMonth={reportOptions.fromMonth}
                  toMonth={reportOptions.toMonth}
                  costCenterListing={reportOptions.costCenterListing}
                  costCenterId={reportOptions.costCenterId}
                  detailLevel={reportOptions.detailLevel}
                  disabled={!canExport}
                />
              </>
            ) : isResumenAnual ? (
              <div className="space-y-4">
                {ANNUAL_SUMMARY_MODELS.map((modelId) => {
                  const model = FISCAL_MODEL_OPTIONS.find((item) => item.id === modelId)!
                  return (
                    <div key={modelId} className="min-w-0 overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                      <p className="mb-2 text-sm font-medium text-emerald-900">{model.label} · anual</p>
                      <FiscalPresentationChoicePanel
                        model={modelId}
                        quarter="anual"
                        year={year}
                        disabled={!canExport}
                        variant="inline"
                      />
                    </div>
                  )
                })}
                <div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canExport || !!bundleLoading}
                    className="w-full gap-2 border-emerald-300 md:w-auto"
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
                    className="w-full gap-2 border-emerald-300 md:w-auto"
                    onClick={() => handleBundleDownload("trimestral")}
                  >
                    {bundleLoading === "trimestral" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    ZIP trimestral (ficheros oficiales)
                  </Button>
                </div>
              </div>
            ) : fiscalExport ? (
              <FiscalPresentationChoicePanel
                model={fiscalExport.model}
                quarter={fiscalExport.quarter}
                year={year}
                disabled={!canExport}
                variant="inline"
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
            Elige Sede de Hacienda o ficheros oficiales. El ZIP guarda todo por si hay que presentar a mano.
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
          year={year}
          compareYear={reportOptions.compareYear}
          compareYears={reportOptions.compareYears}
          breakdown={reportOptions.breakdown}
          fromMonth={reportOptions.fromMonth}
          toMonth={reportOptions.toMonth}
          costCenterListing={reportOptions.costCenterListing}
          costCenterId={reportOptions.costCenterId}
          detailLevel={reportOptions.detailLevel}
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
