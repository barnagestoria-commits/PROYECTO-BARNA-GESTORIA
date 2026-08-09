import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { CalculationDetailRow } from "@/lib/fiscal/model-draft/types"

function extractNombreFromConcepto(concepto: string): string {
  const trimmed = concepto.trim()
  const ivaMatch = trimmed.match(/^IVA\s+[SR]\.\/(.+)$/i)
  if (ivaMatch) return ivaMatch[1].trim()
  const retenMatch = trimmed.match(/^"?Reten\.\/(.+?)(?:\s+\d|$)/i)
  if (retenMatch) return retenMatch[1].trim()
  if (/RETENCION\s+DIVID/i.test(trimmed)) return "Dividendos"
  if (/INTRACOMUNIT|INTRA/i.test(trimmed)) return trimmed.replace(/^IVA\s+[SR]\.\//i, "").trim()
  return trimmed.slice(0, 60)
}

function extractNifFromConcepto(concepto: string): string {
  const match = concepto.match(/\b([A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/i)
  return match?.[1]?.toUpperCase() ?? "—"
}

function claveForModel(
  modelCode: FiscalModelDetailResponse["modelCode"],
  sectionKey: string,
): string {
  if (modelCode === "349") return sectionKey.includes("intra") ? "E" : "A"
  if (modelCode === "303") {
    if (sectionKey === "repercutido") return "01"
    if (sectionKey === "soportado") return "02"
    return "03"
  }
  if (modelCode === "123") return "D"
  if (modelCode === "115") return "R"
  return "A"
}

export function buildCalculationDetailRows(
  detail: FiscalModelDetailResponse,
  sectionKey?: string,
): CalculationDetailRow[] {
  const sections = sectionKey
    ? detail.breakdown.filter((section) => section.key === sectionKey)
    : detail.breakdown

  return sections.flatMap((section) =>
    section.lines
      .filter((line) => line.category !== "asiento" || line.signedAmount !== 0)
      .map((line) => ({
        id: line.lineId,
        entryId: line.entryId,
        lineId: line.lineId,
        cuenta: line.cuenta,
        nif: extractNifFromConcepto(line.concepto),
        nombre: extractNombreFromConcepto(line.concepto),
        claveOperacion: claveForModel(detail.modelCode, section.key),
        importe: line.signedAmount || Math.max(line.debe, line.haber),
        concepto: line.concepto,
        entryDate: line.entryDate,
      })),
  )
}
