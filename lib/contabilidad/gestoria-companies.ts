import type { CompanySummary } from "@/lib/types/auth"

export interface GestoriaCompanyRow {
  id: string
  code: string
  name: string
  type: string
  res: string
  accessPath: string
  cif: string | null
}

export interface GestoriaCompanyFilters {
  code: string
  name: string
  type: string
  res: string
  accessPath: string
}

export const EMPTY_GESTORIA_COMPANY_FILTERS: GestoriaCompanyFilters = {
  code: "",
  name: "",
  type: "",
  res: "",
  accessPath: "",
}

const RES_CODES = ["035", "032", "044", "SUP"] as const

function inferCompanyTaxType(name: string, cif: string | null): string {
  if (cif) {
    const first = cif[0]?.toUpperCase()
    if (first && "ABCFGJHNPQRSUVW".includes(first)) {
      return "Imp. Sociedades"
    }
    if (first && "XYZ".includes(first)) {
      return "Persona Física"
    }
    if (/^\d/.test(cif)) {
      return "Persona Física"
    }
  }

  if (/(\bSL\b|\bSA\b|S\.L\.|S\.A\.)/i.test(name)) {
    return "Imp. Sociedades"
  }

  return "Persona Física"
}

function inferResCode(cif: string | null, index: number): string {
  if (cif) {
    const digits = cif.replace(/\D/g, "")
    if (digits.length >= 3) {
      return digits.slice(0, 3).padStart(3, "0")
    }
  }

  return RES_CODES[index % RES_CODES.length]
}

export function buildGestoriaCompanyCode(index: number): string {
  return String(1564 + index).padStart(5, "0")
}

export function mapCompanyToGestoriaRow(company: CompanySummary, index: number): GestoriaCompanyRow {
  const code = buildGestoriaCompanyCode(index)

  return {
    id: company.id,
    code,
    name: company.name,
    type: inferCompanyTaxType(company.name, company.cif),
    res: inferResCode(company.cif, index),
    accessPath: `\\A3\\A3ECO\\E${code}\\`,
    cif: company.cif,
  }
}

export function mapCompaniesToGestoriaRows(companies: CompanySummary[]): GestoriaCompanyRow[] {
  return [...companies]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map(mapCompanyToGestoriaRow)
}

function matchesFilter(value: string, filter: string): boolean {
  if (!filter.trim()) return true
  return value.toLowerCase().includes(filter.trim().toLowerCase())
}

export function filterGestoriaCompanyRows(
  rows: GestoriaCompanyRow[],
  filters: GestoriaCompanyFilters,
): GestoriaCompanyRow[] {
  return rows.filter(
    (row) =>
      matchesFilter(row.code, filters.code) &&
      matchesFilter(row.name, filters.name) &&
      matchesFilter(row.type, filters.type) &&
      matchesFilter(row.res, filters.res) &&
      matchesFilter(row.accessPath, filters.accessPath),
  )
}
