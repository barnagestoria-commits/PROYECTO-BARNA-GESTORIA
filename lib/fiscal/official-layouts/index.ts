import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"
import type { DraftSection } from "@/lib/fiscal/model-draft/types"
import { buildOfficialModel303Sections, buildModel303CasillaValues, model303CasillaEntries } from "@/lib/fiscal/model-303/official-layout"
import {
  buildOfficialModel111Sections,
  buildOfficialModel115Sections,
  buildOfficialModel123Sections,
  buildOfficialModel180Sections,
  buildOfficialModel190Sections,
} from "@/lib/fiscal/official-layouts/retention-layouts"
import {
  buildOfficialModel347Sections,
  buildOfficialModel390Sections,
  buildModel390CasillaValues,
  model390CasillaEntries,
} from "@/lib/fiscal/official-layouts/informative-layouts"
import { buildOfficialModel349Sections, model349CasillaEntries } from "@/lib/fiscal/official-layouts/model-349-layout"
import { casillaEntriesFromSections } from "@/lib/fiscal/official-layouts/shared"

export type DraftTableLayout = "iva" | "retenciones" | "amount"

export function getDraftTableLayout(modelCode: FiscalModelId): DraftTableLayout {
  if (modelCode === "303" || modelCode === "390") return "iva"
  if (modelCode === "111" || modelCode === "115" || modelCode === "123" || modelCode === "180" || modelCode === "190") {
    return "retenciones"
  }
  return "amount"
}

export function buildOfficialModelSections(detail: FiscalModelDetailResponse): DraftSection[] {
  switch (detail.modelCode) {
    case "303":
      return buildOfficialModel303Sections(detail)
    case "111":
      return buildOfficialModel111Sections(detail)
    case "115":
      return buildOfficialModel115Sections(detail)
    case "123":
      return buildOfficialModel123Sections(detail)
    case "349":
      return buildOfficialModel349Sections(detail)
    case "180":
      return buildOfficialModel180Sections(detail)
    case "190":
      return buildOfficialModel190Sections(detail)
    case "347":
      return buildOfficialModel347Sections(detail)
    case "390":
      return buildOfficialModel390Sections(detail)
    default:
      return []
  }
}

export function resolveDraftResultAmount(detail: FiscalModelDetailResponse): number {
  switch (detail.modelCode) {
    case "303":
      return buildModel303CasillaValues(detail).cuota71
    case "390":
      return buildModel390CasillaValues(detail).cuota71
    case "111":
    case "115":
    case "123":
      return detail.amount
    case "180":
    case "190":
    case "347":
    case "349":
      return detail.amount
    default:
      return detail.amount
  }
}

export function getResultCasillaLabel(modelCode: FiscalModelId): string {
  switch (modelCode) {
    case "303":
      return "Resultado final [71]"
    case "390":
      return "Resultado anual [71]"
    case "111":
      return "Total a ingresar [15]"
    case "115":
      return "Total a ingresar [04]"
    case "123":
      return "Total a ingresar [06]"
    case "347":
      return "Total operaciones [28]"
    case "349":
      return "Total operaciones [03]"
    case "180":
      return "Total retenciones [03]"
    case "190":
      return "Total retenciones [13]"
    default:
      return "Resultado del periodo"
  }
}

export function buildOfficialCasillaEntries(
  detail: FiscalModelDetailResponse,
): Array<{ code: string; amount: number }> {
  switch (detail.modelCode) {
    case "303":
      return model303CasillaEntries(buildModel303CasillaValues(detail))
    case "390":
      return model390CasillaEntries(detail)
    case "349":
      return model349CasillaEntries(detail)
    default:
      return casillaEntriesFromSections(buildOfficialModelSections(detail))
  }
}

export const OFFICIAL_CASILLA_LABELS: Record<string, Record<string, string>> = {
  "111": {
    "01": "NUM PERCEPTORES TRABAJO",
    "02": "IMPORTE PERCEPCIONES TRABAJO",
    "03": "RETENCIONES TRABAJO",
    "13": "SUMA RETENCIONES",
    "15": "TOTAL A INGRESAR",
  },
  "115": {
    "01": "NUM PERCEPTORES ARRENDAMIENTOS",
    "02": "BASE RETENCIONES ARRENDAMIENTOS",
    "03": "RETENCIONES PRACTICADAS",
    "04": "TOTAL A INGRESAR",
  },
  "123": {
    "01": "NUM PERCEPTORES",
    "02": "BASE RETENCIONES",
    "04": "RETENCIONES DIVIDENDOS",
    "05": "TOTAL RETENCIONES",
    "06": "TOTAL A INGRESAR",
  },
  "180": {
    "01": "NUM PERCEPTORES ANUAL",
    "02": "IMPORTE PERCEPCIONES ANUAL",
    "03": "TOTAL RETENCIONES ANUAL",
  },
  "190": {
    "03": "RETENCIONES TRABAJO",
    "12": "RETENCIONES ARRENDAMIENTOS",
    "09": "RETENCIONES CAPITAL MOBILIARIO",
    "13": "TOTAL RETENCIONES ANUAL",
  },
  "347": {
    "03": "IMPORTE OPERACIONES NO METALICO",
    "04": "NUM DECLARADOS",
    "28": "TOTAL IMPORTE OPERACIONES",
  },
  "349": {
    "01": "NUM OPERADORES COMUNITARIOS",
    "02": "IMPORTE OPERACIONES INTRACOMUNITARIAS",
    "03": "TOTAL OPERACIONES",
  },
}
