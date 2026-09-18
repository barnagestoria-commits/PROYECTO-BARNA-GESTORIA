import { normalizeTaxId } from "@/lib/tax-id"
import { slugifyCompanyName } from "@/lib/reports/report-query"

export function normalizeAeatNif(value: string | null | undefined): string {
  return normalizeTaxId(value ?? "").slice(0, 9).padEnd(9, "X")
}

export function buildLibrosRegistroFilename(params: {
  year: number
  companyCif: string | null | undefined
  companyName: string
  bookType?: "C" | "D" | "T"
}): string {
  const nif = normalizeTaxId(params.companyCif ?? "").slice(0, 9) || "SINNIF"
  const tipo = params.bookType ?? "T"
  const name = slugifyCompanyName(params.companyName).replace(/-/g, " ").slice(0, 40).trim() || "empresa"
  return `${params.year}${nif}${tipo}${name}.xlsx`
}
