import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftCasilla, DraftSection } from "@/lib/fiscal/model-draft/types"

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function allContributingLines(detail: FiscalModelDetailResponse) {
  return detail.breakdown.flatMap((section) => section.lines.filter((line) => line.category === "contributing"))
}

export function countPerceptores(detail: FiscalModelDetailResponse): number {
  return new Set(allContributingLines(detail).map((line) => line.entryId)).size
}

export function sumContributing(detail: FiscalModelDetailResponse): number {
  return round2(allContributingLines(detail).reduce((sum, line) => sum + line.signedAmount, 0))
}

export function deriveBaseFromRetention(retenciones: number, rate = 0.19): number {
  if (retenciones <= 0) return 0
  return round2(retenciones / rate)
}

export function sectionTotal(detail: FiscalModelDetailResponse, key: string): number {
  return detail.breakdown.find((section) => section.key === key)?.total ?? 0
}

export function casillaAmount(
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

export function casillaPair(
  id: string,
  baseCode: string,
  amountCode: string,
  label: string,
  baseAmount: number,
  amount: number,
  sectionKey: string,
  description?: string,
): DraftCasilla {
  return {
    id,
    code: baseCode,
    relatedCode: amountCode,
    label,
    description,
    baseAmount,
    amount,
    sectionKey,
    clickable: true,
  }
}

export function casillaEntriesFromSections(sections: DraftSection[]): Array<{ code: string; amount: number }> {
  const entries: Array<{ code: string; amount: number }> = []
  for (const section of sections) {
    for (const cell of section.casillas) {
      if (cell.baseAmount !== undefined && cell.relatedCode) {
        entries.push({ code: cell.code, amount: cell.baseAmount })
        entries.push({ code: cell.relatedCode, amount: cell.amount })
      } else {
        entries.push({ code: cell.code, amount: cell.amount })
      }
    }
  }
  return entries
}

export function hasLiquidation(detail: FiscalModelDetailResponse): boolean {
  return detail.breakdown.some((section) => section.key === "liquidacion" || section.key === "nrc-pago")
}
