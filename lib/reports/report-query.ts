import type { ReportType } from "@/lib/reports/types"

export const VALID_REPORT_TYPES = new Set<ReportType>(["balance", "sumas-saldos", "pyg"])

export interface ParsedReportQuery {
  year: number
  fromMonth?: number
  toMonth?: number
  costCenterId?: string
}

export function parseYear(value: string | null): number | null {
  if (!value) return new Date().getFullYear()
  const year = Number.parseInt(value, 10)
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null
  return year
}

export function parseMonth(value: string | null): number | undefined {
  if (!value) return undefined
  const month = Number.parseInt(value, 10)
  if (!Number.isFinite(month) || month < 1 || month > 12) return undefined
  return month
}

export function parseReportQueryFromUrl(url: URL): ParsedReportQuery | { error: string } {
  const year = parseYear(url.searchParams.get("year"))
  if (year === null) return { error: "Ejercicio no válido." }
  const costCenterId = url.searchParams.get("costCenterId")?.trim() || undefined
  return {
    year,
    fromMonth: parseMonth(url.searchParams.get("fromMonth")),
    toMonth: parseMonth(url.searchParams.get("toMonth")),
    costCenterId,
  }
}

export function slugifyCompanyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

export function buildReportFilename(
  type: ReportType,
  companyName: string,
  year: number,
  extension: "pdf" | "xlsx" | "csv" | "zip",
): string {
  const prefix: Record<ReportType, string> = {
    balance: "balance",
    "sumas-saldos": "sumas-saldos",
    pyg: "pyg",
  }
  const suffix = extension === "zip" ? "export" : String(year)
  return `${prefix[type]}-${slugifyCompanyName(companyName)}-${suffix}.${extension}`
}

export function buildListadosBundleFilename(companyName: string, year: number): string {
  return `listados-contables-${slugifyCompanyName(companyName)}-${year}.zip`
}
