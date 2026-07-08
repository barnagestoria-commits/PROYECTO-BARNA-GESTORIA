import type { ReportType } from "@/lib/reports/types"
import type { SerializedPreview } from "@/components/report-preview-content"

function getReportUrl(type: ReportType, format: "pdf" | "xlsx" | "preview", year?: number): string {
  const y = year ?? new Date().getFullYear()
  return `/api/reports/${type}/${format}?year=${y}`
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

export function getReportPdfUrl(type: ReportType, year?: number): string {
  return getReportUrl(type, "pdf", year)
}

export function getReportExcelUrl(type: ReportType, year?: number): string {
  return getReportUrl(type, "xlsx", year)
}

export async function downloadReportPdf(type: ReportType, year?: number): Promise<void> {
  await downloadReportBlob(getReportPdfUrl(type, year), `${type}.pdf`, "No se pudo generar el PDF.")
}

export async function downloadReportExcel(type: ReportType, year?: number): Promise<void> {
  await downloadReportBlob(
    getReportExcelUrl(type, year),
    `${type}.xlsx`,
    "No se pudo generar el Excel.",
  )
}

export async function fetchReportPreview(
  type: ReportType,
  year?: number,
): Promise<SerializedPreview> {
  const response = await fetch(getReportUrl(type, "preview", year), { credentials: "include" })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? "No se pudo cargar la vista previa.")
  }

  return data.preview as SerializedPreview
}

export const INFORME_REPORT_TYPES = {
  balance: "balance",
  "sumas-saldos": "sumas-saldos",
  pyg: "pyg",
} as const satisfies Record<string, ReportType>
