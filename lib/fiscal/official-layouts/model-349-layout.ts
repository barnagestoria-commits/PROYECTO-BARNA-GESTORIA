import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftCasilla, DraftSection } from "@/lib/fiscal/model-draft/types"
import {
  detectModel349Clave,
  MODEL_349_CLAVE_LABELS,
  MODEL_349_CLAVE_ORDER,
  model349SectionKeyForClave,
  type Model349Clave,
} from "@/lib/fiscal/model-349-claves"
import {
  collectModel349EntryText,
  findModel349IvaContextLine,
} from "@/lib/fiscal/model-349-base-imponible"
import { extractPrimaryEuVatId, formatEuVatIdForAeat } from "@/lib/fiscal/eu-vat-id"
import { casillaAmount, hasLiquidation } from "@/lib/fiscal/official-layouts/shared"

function casilla(
  id: string,
  code: string,
  label: string,
  amount: number,
  sectionKey: string,
  description?: string,
): DraftCasilla {
  return {
    id,
    code,
    label,
    description,
    amount,
    sectionKey,
    clickable: true,
  }
}

export function buildOfficialModel349Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const allLines = detail.breakdown.flatMap((section) => section.lines)
  const contributingLines = allLines.filter((line) => line.category === "contributing")
  const total = hasLiquidation(detail) ? detail.amount : detail.amount

  const operadores = new Set(
    contributingLines.map((line) => {
      const vatId = extractPrimaryEuVatId(collectModel349EntryText(line, allLines))
      return vatId ? formatEuVatIdForAeat(vatId) : line.entryId
    }),
  ).size

  const byClave = new Map<Model349Clave, { operadores: Set<string>; total: number }>()

  for (const line of contributingLines) {
    const contextLine = findModel349IvaContextLine(line, allLines)
    const clave = detectModel349Clave({
      concepto: contextLine.concepto,
      entryConcept: line.entryConcept,
      cuenta: contextLine.cuenta,
      debe: contextLine.debe,
      haber: contextLine.haber,
    })
    const vatId = extractPrimaryEuVatId(collectModel349EntryText(line, allLines))
    const operatorKey = vatId ? formatEuVatIdForAeat(vatId) : line.entryId

    const group = byClave.get(clave) ?? { operadores: new Set<string>(), total: 0 }
    group.operadores.add(operatorKey)
    group.total += line.signedAmount
    byClave.set(clave, group)
  }

  const claveCasillas: DraftCasilla[] = MODEL_349_CLAVE_ORDER.filter((clave) => byClave.has(clave)).map(
    (clave) => {
      const group = byClave.get(clave)!
      return casilla(
        `349-clave-${clave}`,
        clave,
        MODEL_349_CLAVE_LABELS[clave],
        group.total,
        model349SectionKeyForClave(clave),
        `${group.operadores.size} operador${group.operadores.size === 1 ? "" : "es"}`,
      )
    },
  )

  const sections: DraftSection[] = [
    {
      id: "intracomunitarias",
      title: "Operaciones intracomunitarias",
      casillas: [
        casilla("349-01", "01", "Número de operadores comunitarios", operadores, "intracomunitarias"),
        casilla("349-02", "02", "Importe de las operaciones intracomunitarias", total, "intracomunitarias"),
      ],
    },
  ]

  if (claveCasillas.length > 0) {
    sections.push({
      id: "claves-operacion",
      title: "Desglose por clave de operación",
      casillas: claveCasillas,
    })
  }

  sections.push({
    id: "resultado",
    title: "Resumen de la declaración",
    casillas: [
      casillaAmount(
        "349-03",
        "03",
        "Total operaciones declaradas",
        total,
        "intracomunitarias",
        "Declaración recapitulativa trimestral",
      ),
    ],
  })

  return sections
}

export function model349CasillaEntries(detail: FiscalModelDetailResponse): Array<{ code: string; amount: number }> {
  const sections = buildOfficialModel349Sections(detail)
  const entries: Array<{ code: string; amount: number }> = []
  for (const section of sections) {
    for (const cell of section.casillas) {
      entries.push({ code: cell.code, amount: cell.amount })
    }
  }
  return entries
}
