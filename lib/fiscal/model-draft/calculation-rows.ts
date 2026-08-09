import {
  detectModel349Clave,
  parseModel349SectionKey,
} from "@/lib/fiscal/model-349-claves"
import {
  collectModel349EntryText,
  findModel349IvaContextLine,
} from "@/lib/fiscal/model-349-base-imponible"
import { extractPrimaryEuVatId, formatEuVatIdForAeat } from "@/lib/fiscal/eu-vat-id"
import type { CalculationDetailRow } from "@/lib/fiscal/model-draft/types"
import type {
  FiscalModelBreakdownLine,
  FiscalModelDetailResponse,
} from "@/lib/types/fiscal-panorama"

function extractNombreFromConcepto(concepto: string): string {
  const trimmed = concepto.trim()
  const ivaMatch = trimmed.match(/^IVA\s+[SR]\.\/(.+)$/i)
  if (ivaMatch) {
    const party = ivaMatch[1].trim()
    const withoutVat = party.replace(/\b[A-Z]{2}[\s.\-/]?[A-Z0-9]{2,12}\b/gi, "").trim()
    return (withoutVat || party).slice(0, 60)
  }
  const retenMatch = trimmed.match(/^"?Reten\.\/(.+?)(?:\s+\d|$)/i)
  if (retenMatch) return retenMatch[1].trim()
  if (/RETENCION\s+DIVID/i.test(trimmed)) return "Dividendos"
  if (/INTRACOMUNIT|INTRA/i.test(trimmed)) return trimmed.replace(/^IVA\s+[SR]\.\//i, "").trim()
  return trimmed.slice(0, 60)
}

function extractSpanishNifFromConcepto(concepto: string): string {
  const match = concepto.match(/\b([A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/i)
  return match?.[1]?.toUpperCase() ?? "—"
}

function extractNifFor349(line: FiscalModelBreakdownLine, sectionLines: FiscalModelBreakdownLine[]): string {
  const contextLine = findModel349IvaContextLine(line, sectionLines)
  const fromIvaLine = extractPrimaryEuVatId(contextLine.concepto)
  if (fromIvaLine) return formatEuVatIdForAeat(fromIvaLine)

  const entryText = collectModel349EntryText(line, sectionLines)
  const euVat = extractPrimaryEuVatId(entryText)
  if (euVat) return formatEuVatIdForAeat(euVat)

  return extractSpanishNifFromConcepto(contextLine.concepto)
}

function claveForModel(
  modelCode: FiscalModelDetailResponse["modelCode"],
  sectionKey: string,
): string {
  if (modelCode === "303") {
    if (sectionKey === "repercutido") return "01"
    if (sectionKey === "soportado") return "02"
    return "03"
  }
  if (modelCode === "123") return "D"
  if (modelCode === "115") return "R"
  return "A"
}

function claveFor349Line(line: FiscalModelBreakdownLine, sectionLines: FiscalModelBreakdownLine[]): string {
  const contextLine = findModel349IvaContextLine(line, sectionLines)
  return detectModel349Clave({
    concepto: contextLine.concepto,
    entryConcept: line.entryConcept,
    cuenta: contextLine.cuenta,
    debe: contextLine.debe,
    haber: contextLine.haber,
  })
}

export function buildCalculationDetailRows(
  detail: FiscalModelDetailResponse,
  sectionKey?: string,
): CalculationDetailRow[] {
  const claveFilter = sectionKey ? parseModel349SectionKey(sectionKey) : null
  const sections = sectionKey && !claveFilter
    ? detail.breakdown.filter((section) => section.key === sectionKey)
    : detail.breakdown

  const rows = sections.flatMap((section) => {
    const contributingLines =
      detail.modelCode === "349"
        ? section.lines.filter((line) => line.category === "contributing")
        : section.lines.filter((line) => line.category !== "asiento" || line.signedAmount !== 0)

    return contributingLines.map((line) => {
      const contextLine =
        detail.modelCode === "349" ? findModel349IvaContextLine(line, section.lines) : line

      return {
        id: line.lineId,
        entryId: line.entryId,
        lineId: line.lineId,
        cuenta: line.cuenta,
        nif:
          detail.modelCode === "349"
            ? extractNifFor349(line, section.lines)
            : extractSpanishNifFromConcepto(line.concepto),
        nombre: extractNombreFromConcepto(contextLine.concepto),
        claveOperacion:
          detail.modelCode === "349"
            ? claveFor349Line(line, section.lines)
            : claveForModel(detail.modelCode, section.key),
        importe: line.signedAmount || Math.max(line.debe, line.haber),
        concepto: line.concepto,
        entryDate: line.entryDate,
      }
    })
  })

  if (claveFilter) {
    return rows.filter((row) => row.claveOperacion === claveFilter)
  }

  return rows
}
