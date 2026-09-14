import {
  detectModel349Clave,
  formatModel349Clave,
  isModel349Clave,
  parseModel349SectionKey,
} from "@/lib/fiscal/model-349-claves"
import {
  collectModel349EntryText,
  findModel349IvaContextLine,
} from "@/lib/fiscal/model-349-base-imponible"
import { extractPrimaryEuVatId, formatEuVatIdForAeat } from "@/lib/fiscal/eu-vat-id"
import {
  extractPartyDisplayName,
  extractSpanishTaxId,
} from "@/lib/fiscal/party-identification"
import type { CalculationDetailRow } from "@/lib/fiscal/model-draft/types"
import type {
  FiscalModelBreakdownLine,
  FiscalModelDetailResponse,
  FiscalModelId,
} from "@/lib/types/fiscal-panorama"

function extractNifFor349(line: FiscalModelBreakdownLine, sectionLines: FiscalModelBreakdownLine[]): string {
  const contextLine = findModel349IvaContextLine(line, sectionLines)
  const fromIvaLine = extractPrimaryEuVatId(contextLine.concepto, contextLine.nif, line.nif)
  if (fromIvaLine) return formatEuVatIdForAeat(fromIvaLine)

  const entryText = collectModel349EntryText(line, sectionLines)
  const euVat = extractPrimaryEuVatId(entryText, line.nif, contextLine.nif)
  if (euVat) return formatEuVatIdForAeat(euVat)

  return resolvedSpanishNif(contextLine) ?? resolvedSpanishNif(line) ?? "—"
}

function resolvedSpanishNif(line: FiscalModelBreakdownLine): string | null {
  if (line.nif && extractPrimaryEuVatId(line.nif)) return null
  if (line.nif?.trim()) return line.nif.trim().toUpperCase()
  return extractSpanishTaxId(`${line.concepto} ${line.entryConcept ?? ""}`)
}

function resolvedNombre(line: FiscalModelBreakdownLine, fallbackConcepto: string): string {
  if (line.nombre?.trim()) return line.nombre.trim()
  return extractPartyDisplayName(fallbackConcepto) || fallbackConcepto.slice(0, 60)
}

function claveForModel(
  modelCode: FiscalModelDetailResponse["modelCode"],
  sectionKey: string,
): string {
  if (modelCode === "303" || modelCode === "390") {
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

export function calculationClaveColumnLabel(modelCode: FiscalModelId): string {
  if (modelCode === "303" || modelCode === "390") return "Casilla"
  return "Clave"
}

export function describeCalculationClave(modelCode: FiscalModelId, clave: string): string | undefined {
  if (modelCode === "303" || modelCode === "390") {
    if (clave === "01") return "Casilla 01 · IVA repercutido"
    if (clave === "02") return "Casilla 02 · IVA soportado"
    return `Casilla ${clave}`
  }
  if (modelCode === "349" && isModel349Clave(clave)) {
    return formatModel349Clave(clave)
  }
  if (modelCode === "111" || modelCode === "190") {
    return "Clave A · Rendimientos del trabajo y actividades profesionales"
  }
  if (modelCode === "115" || modelCode === "180") {
    return "Clave R · Arrendamientos de inmuebles urbanos"
  }
  if (modelCode === "123") {
    return "Clave D · Dividendos y otras rentas del capital mobiliario"
  }
  return undefined
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
            : resolvedSpanishNif(line) ?? "—",
        nombre: resolvedNombre(contextLine, contextLine.concepto),
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
