import type { GestoriaAccountDetailLevel } from "@/lib/contabilidad/gestoria-presentation-config"
import type { CostCenterListing, ReportBreakdown } from "@/lib/reports/statement-layout"
import type { ReportType } from "@/lib/reports/types"

export const VALID_REPORT_TYPES = new Set<ReportType>(["balance", "sumas-saldos", "pyg"])

const ACCOUNT_DETAIL_LEVELS = new Set<GestoriaAccountDetailLevel>([
  "NIVEL_3",
  "NIVEL_4",
  "SUBCUENTAS",
])

export interface ParsedReportQuery {
  year: number
  compareYear: number | null
  compareYears: number[]
  breakdown: ReportBreakdown
  costCenterListing: CostCenterListing
  fromMonth?: number
  toMonth?: number
  costCenterId?: string
  detailLevel: GestoriaAccountDetailLevel
}

export function parseAccountDetailLevel(
  value: string | null | undefined,
  fallback: GestoriaAccountDetailLevel = "SUBCUENTAS",
): GestoriaAccountDetailLevel {
  if (value && ACCOUNT_DETAIL_LEVELS.has(value as GestoriaAccountDetailLevel)) {
    return value as GestoriaAccountDetailLevel
  }
  return fallback
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

function parseCompareYear(value: string | null, year: number): number | null | { error: string } {
  if (!value || value === "none") return null
  const compareYear = Number.parseInt(value, 10)
  if (!Number.isFinite(compareYear) || compareYear < 2000 || compareYear > 2100) {
    return { error: "El ejercicio de comparativa no es válido." }
  }
  if (compareYear === year) return null
  return compareYear
}

function parseCompareYears(value: string | null, year: number, single: number | null): number[] | { error: string } {
  const years = new Set<number>()
  if (single) years.add(single)
  if (!value) return [...years]
  for (const part of value.split(",")) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
      return { error: "Hay un ejercicio de comparativa que no es válido." }
    }
    if (parsed !== year) years.add(parsed)
  }
  return [...years].sort((a, b) => b - a).slice(0, 5)
}

function parseBreakdown(value: string | null): ReportBreakdown {
  if (value === "trimestral" || value === "mensual") return value
  return "anual"
}

function parseCostCenterListing(value: string | null): CostCenterListing {
  if (value === "centro" || value === "por-centros") return value
  return "consolidado"
}

export function parseReportQueryFromUrl(url: URL): ParsedReportQuery | { error: string } {
  const year = parseYear(url.searchParams.get("year"))
  if (year === null) return { error: "Ejercicio no válido." }
  const compareYear = parseCompareYear(url.searchParams.get("compareYear"), year)
  if (compareYear && typeof compareYear === "object") return compareYear
  const compareYears = parseCompareYears(url.searchParams.get("compareYears"), year, compareYear)
  if (!Array.isArray(compareYears)) return compareYears
  const costCenterId = url.searchParams.get("costCenterId")?.trim() || undefined
  const fromMonth = parseMonth(url.searchParams.get("fromMonth"))
  const toMonth = parseMonth(url.searchParams.get("toMonth"))
  return {
    year,
    compareYear: compareYears[0] ?? null,
    compareYears,
    breakdown: parseBreakdown(url.searchParams.get("breakdown")),
    costCenterListing: parseCostCenterListing(url.searchParams.get("costCenters")),
    fromMonth: fromMonth && toMonth && fromMonth > toMonth ? toMonth : fromMonth,
    toMonth: fromMonth && toMonth && fromMonth > toMonth ? fromMonth : toMonth,
    costCenterId,
    detailLevel: parseAccountDetailLevel(url.searchParams.get("detail")),
  }
}

export function toLedgerQueryFields(companyId: string, parsed: ParsedReportQuery) {
  return {
    companyId,
    year: parsed.year,
    compareYear: parsed.compareYear,
    compareYears: parsed.compareYears,
    breakdown: parsed.breakdown,
    costCenterListing: parsed.costCenterListing,
    fromMonth: parsed.fromMonth,
    toMonth: parsed.toMonth,
    costCenterId: parsed.costCenterId,
    detailLevel: parsed.detailLevel,
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
