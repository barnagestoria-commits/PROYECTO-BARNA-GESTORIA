import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import type { ReportType } from "@/lib/reports/types"
import type { ReportExportFormat } from "@/lib/reports/export-formats"
import type { SerializedPreview } from "@/components/report-preview-content"

export interface ReportDownloadParams {
  year?: number
  costCenterId?: string
  detailLevel?: GestoriaAccountDetailLevel
}

async function downloadReportBlob(
  url: string,
  fallbackName: string,
  fallbackError: string,
): Promise<void> {
  const response = await fetch(url, { credentials: "include" })

  if (!response.ok) {
    let message = fallbackError
    try {
      const data = await response.json()
      message = data.error ?? message
    } catch {
      // binary or empty body
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? fallbackName

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function getReportUrl(
  type: ReportType,
  format: ReportExportFormat | "preview",
  params: ReportDownloadParams = {},
): string {
  const y = params.year ?? new Date().getFullYear()
  const search = new URLSearchParams({ year: String(y) })
  if (params.costCenterId) search.set("costCenterId", params.costCenterId)
  if (params.detailLevel) search.set("detail", params.detailLevel)
  return `/api/reports/${type}/${format}?${search.toString()}`
}

export function getReportPdfUrl(type: ReportType, year?: number): string {
  return getReportUrl(type, "pdf", { year })
}

export function getReportExcelUrl(type: ReportType, year?: number): string {
  return getReportUrl(type, "xlsx", { year })
}

export function getReportCsvUrl(type: ReportType, year?: number): string {
  return getReportUrl(type, "csv", { year })
}

export function getReportZipUrl(type: ReportType, year?: number): string {
  return getReportUrl(type, "zip", { year })
}

export function getListadosBundleZipUrl(params: ReportDownloadParams = {}): string {
  const y = params.year ?? new Date().getFullYear()
  const search = new URLSearchParams({ year: String(y) })
  if (params.costCenterId) search.set("costCenterId", params.costCenterId)
  if (params.detailLevel) search.set("detail", params.detailLevel)
  return `/api/reports/bundle/zip?${search.toString()}`
}

export async function downloadReport(
  type: ReportType,
  format: ReportExportFormat,
  year?: number,
  options: Omit<ReportDownloadParams, "year"> = {},
): Promise<void> {
  const labels: Record<ReportExportFormat, string> = {
    pdf: "PDF",
    xlsx: "Excel",
    csv: "CSV",
    zip: "ZIP",
  }

  await downloadReportBlob(
    getReportUrl(type, format, { year, ...options }),
    `${type}.${format === "xlsx" ? "xlsx" : format}`,
    `No se pudo generar el ${labels[format]}.`,
  )
}

export async function downloadReportPdf(type: ReportType, year?: number): Promise<void> {
  await downloadReport(type, "pdf", year)
}

export async function downloadReportExcel(type: ReportType, year?: number): Promise<void> {
  await downloadReport(type, "xlsx", year)
}

export async function downloadReportCsv(type: ReportType, year?: number): Promise<void> {
  await downloadReport(type, "csv", year)
}

export async function downloadReportZip(type: ReportType, year?: number): Promise<void> {
  await downloadReport(type, "zip", year)
}

export async function downloadListadosBundleZip(
  year?: number,
  options: Omit<ReportDownloadParams, "year"> = {},
): Promise<void> {
  await downloadReportBlob(
    getListadosBundleZipUrl({ year, ...options }),
    "listados-contables.zip",
    "No se pudo generar el paquete ZIP de listados.",
  )
}

export async function fetchReportPreview(
  type: ReportType,
  year?: number,
  options: Omit<ReportDownloadParams, "year"> = {},
): Promise<SerializedPreview> {
  const response = await fetch(getReportUrl(type, "preview", { year, ...options }), {
    credentials: "include",
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? "No se pudo cargar la vista previa.")
  }

  return data.preview as SerializedPreview
}

import type { FiscalExportFormat } from "@/lib/fiscal/export-formats"
export type { FiscalExportFormat }

function getFiscalExportUrl(
  model: string,
  year: number,
  quarter: string | number,
  format: FiscalExportFormat,
): string {
  return `/api/fiscal/export/${model}/${year}/${quarter}/${format}`
}

export async function downloadFiscalExport(
  model: string,
  year: number,
  quarter: string | number,
  format: FiscalExportFormat,
): Promise<void> {
  const labels: Record<FiscalExportFormat, string> = {
    pdf: "PDF",
    xlsx: "Excel",
    csv: "CSV",
    txt: "TXT Hacienda",
    lsi: "Excel Hacienda",
    zip: "ZIP",
  }

  await downloadReportBlob(
    getFiscalExportUrl(model, year, quarter, format),
    `modelo-${model}.${format === "xlsx" || format === "lsi" ? "xlsx" : format}`,
    `No se pudo generar el ${labels[format]} del modelo ${model}.`,
  )
}

export async function downloadFiscalBundleZip(
  year?: number,
  scope: "annual" | "trimestral" = "annual",
): Promise<void> {
  const y = year ?? new Date().getFullYear()
  await downloadReportBlob(
    `/api/fiscal/bundle/zip?year=${y}&scope=${scope}`,
    scope === "annual" ? "modelos-fiscales-anual.zip" : "modelos-fiscales-trimestral.zip",
    "No se pudo generar el paquete ZIP fiscal.",
  )
}

export const INFORME_REPORT_TYPES = {
  balance: "balance",
  "sumas-saldos": "sumas-saldos",
  pyg: "pyg",
} as const satisfies Record<string, ReportType>

export const CERTIFICADO_FISCAL_MODELS: Record<string, { model: string; quarter: string | number }> = {
  "retenciones-profesionales": { model: "111", quarter: "annual" },
  "retenciones-alquiler": { model: "115", quarter: "annual" },
}
