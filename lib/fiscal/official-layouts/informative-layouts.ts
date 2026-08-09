import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftSection } from "@/lib/fiscal/model-draft/types"
import {
  casillaAmount,
  countPerceptores,
  hasLiquidation,
  round2,
  sectionTotal,
  sumContributing,
} from "@/lib/fiscal/official-layouts/shared"

function extractSpanishNif(text: string): string | null {
  const match = text.match(/\b([A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/i)
  return match?.[1]?.toUpperCase() ?? null
}

function countDeclarados(detail: FiscalModelDetailResponse): number {
  const lines = detail.breakdown.flatMap((section) => section.lines.filter((line) => line.category === "contributing"))
  const keys = new Set<string>()
  for (const line of lines) {
    const nif = extractSpanishNif(`${line.concepto} ${line.entryConcept ?? ""}`)
    keys.add(nif ?? line.entryId)
  }
  return keys.size
}

export function buildOfficialModel347Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const total = hasLiquidation(detail)
    ? detail.amount
    : sectionTotal(detail, "operaciones-terceros") || sectionTotal(detail, "liquidacion") || sumContributing(detail) || detail.amount
  const declarados = countDeclarados(detail)

  return [
    {
      id: "operaciones-metalico",
      title: "A. Operaciones en metálico",
      casillas: [
        casillaAmount("347-01", "01", "Importe total anual de las operaciones en metálico", 0, "operaciones-terceros"),
        casillaAmount("347-02", "02", "Número total de perceptores", 0, "operaciones-terceros"),
      ],
    },
    {
      id: "operaciones-no-metalico",
      title: "B. Operaciones no consideradas realizadas en metálico",
      casillas: [
        casillaAmount("347-03", "03", "Importe total anual de las operaciones", total, "operaciones-terceros"),
        casillaAmount("347-04", "04", "Número total de declarados", declarados, "operaciones-terceros"),
      ],
    },
    {
      id: "resultado",
      title: "C. Resumen de la declaración",
      casillas: [
        casillaAmount(
          "347-28",
          "28",
          "Total importe de las operaciones ([01]+[03])",
          total,
          "operaciones-terceros",
          "Declaración informativa anual",
        ),
      ],
    },
  ]
}

export function buildOfficialModel390Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const repercutido = sectionTotal(detail, "repercutido")
  const soportado = sectionTotal(detail, "soportado")
  const resumen = sectionTotal(detail, "resumen-iva")
  const totalDevengado = repercutido > 0 ? repercutido : 0
  const totalDeducible = soportado > 0 ? soportado : 0
  const diferencia = round2(totalDevengado - totalDeducible)
  const resultado = hasLiquidation(detail) || resumen > 0 ? detail.amount : diferencia !== 0 ? diferencia : detail.amount

  const baseDevengado = totalDevengado > 0 ? round2(totalDevengado / 0.21) : 0
  const baseDeducible = totalDeducible > 0 ? round2(totalDeducible / 0.21) : 0

  return [
    {
      id: "iva-devengado-anual",
      title: "A. IVA devengado — Resumen anual",
      casillas: [
        {
          id: "390-01",
          code: "01",
          relatedCode: "03",
          label: "Régimen general — base y cuota anual devengada",
          baseAmount: baseDevengado,
          amount: totalDevengado,
          sectionKey: "resumen-iva",
          clickable: true,
        },
        {
          id: "390-27",
          code: "27",
          label: "Total cuota devengada anual",
          amount: totalDevengado,
          sectionKey: "resumen-iva",
          clickable: true,
          description: "Suma de cuotas repercutidas del ejercicio",
        },
      ],
    },
    {
      id: "iva-deducible-anual",
      title: "B. IVA deducible — Resumen anual",
      casillas: [
        {
          id: "390-28",
          code: "28",
          relatedCode: "29",
          label: "Por operaciones interiores corrientes",
          baseAmount: baseDeducible,
          amount: totalDeducible,
          sectionKey: "resumen-iva",
          clickable: true,
        },
        {
          id: "390-45",
          code: "45",
          label: "Total a deducir",
          amount: totalDeducible,
          sectionKey: "resumen-iva",
          clickable: true,
          description: "Suma de cuotas soportadas deducibles del ejercicio",
        },
      ],
    },
    {
      id: "resultado-anual",
      title: "C. Resultado de la liquidación anual",
      casillas: [
        {
          id: "390-46",
          code: "46",
          label: "Diferencia ( [27] − [45] )",
          amount: diferencia !== 0 ? diferencia : round2(resultado),
          sectionKey: "resumen-iva",
          clickable: true,
        },
        {
          id: "390-71",
          code: "71",
          label: resultado >= 0 ? "Resultado: Importe a ingresar" : "Resultado: Importe a devolver / compensar",
          amount: resultado,
          sectionKey: "resumen-iva",
          clickable: true,
          description: "Resultado final del ejercicio",
        },
      ],
    },
  ]
}

export function buildModel390CasillaValues(detail: FiscalModelDetailResponse) {
  const repercutido = sectionTotal(detail, "repercutido")
  const soportado = sectionTotal(detail, "soportado")
  const totalDevengado = repercutido > 0 ? repercutido : 0
  const totalDeducible = soportado > 0 ? soportado : 0
  const diferencia = round2(totalDevengado - totalDeducible)
  const resultado = detail.amount
  return {
    base01: totalDevengado > 0 ? round2(totalDevengado / 0.21) : 0,
    cuota03: totalDevengado,
    cuota27: totalDevengado,
    base28: totalDeducible > 0 ? round2(totalDeducible / 0.21) : 0,
    cuota29: totalDeducible,
    cuota45: totalDeducible,
    cuota46: diferencia !== 0 ? diferencia : round2(resultado),
    cuota71: resultado,
  }
}

export function model390CasillaEntries(detail: FiscalModelDetailResponse): Array<{ code: string; amount: number }> {
  const v = buildModel390CasillaValues(detail)
  return [
    { code: "01", amount: v.base01 },
    { code: "03", amount: v.cuota03 },
    { code: "27", amount: v.cuota27 },
    { code: "28", amount: v.base28 },
    { code: "29", amount: v.cuota29 },
    { code: "45", amount: v.cuota45 },
    { code: "46", amount: v.cuota46 },
    { code: "71", amount: v.cuota71 },
  ]
}
