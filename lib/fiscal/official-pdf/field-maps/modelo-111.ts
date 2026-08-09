import type { OverlayTextField } from "@/lib/fiscal/official-pdf/overlay-utils"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { buildOfficialModel111Sections } from "@/lib/fiscal/official-layouts/retention-layouts"

function amountField(x: number, y: number, kind: "amount" | "integer" = "amount"): OverlayTextField {
  return { page: 0, x, y, align: "right", kind, eraseWidth: 80, eraseHeight: 14 }
}

export const MODELO_111_IDENTITY = {
  nif: { page: 0, x: 150, y: 627, eraseWidth: 90, eraseHeight: 14 },
  companyName: { page: 0, x: 280, y: 610, maxWidth: 250, eraseWidth: 250, eraseHeight: 28 },
  year: { page: 0, x: 443, y: 721, eraseWidth: 40, eraseHeight: 14 },
  period: { page: 0, x: 545, y: 722, eraseWidth: 24, eraseHeight: 14 },
} satisfies Record<string, OverlayTextField>

function casillaAmount(code: string, detail: FiscalModelDetailResponse): number {
  for (const section of buildOfficialModel111Sections(detail)) {
    for (const cell of section.casillas) {
      if (cell.code === code) return cell.amount
      if (cell.relatedCode === code) return cell.amount
    }
  }
  return 0
}

export function buildModelo111OverlayFields(
  detail: FiscalModelDetailResponse,
): Array<{ field: OverlayTextField; value: number }> {
  return [
    { field: amountField(340, 579, "integer"), value: casillaAmount("01", detail) },
    { field: amountField(430, 579), value: casillaAmount("02", detail) },
    { field: amountField(555, 579), value: casillaAmount("03", detail) },
    { field: amountField(340, 555, "integer"), value: casillaAmount("04", detail) },
    { field: amountField(430, 555), value: casillaAmount("05", detail) },
    { field: amountField(555, 555), value: casillaAmount("06", detail) },
    { field: amountField(340, 520, "integer"), value: casillaAmount("07", detail) },
    { field: amountField(430, 520), value: casillaAmount("08", detail) },
    { field: amountField(555, 520), value: casillaAmount("09", detail) },
    { field: amountField(340, 498, "integer"), value: casillaAmount("10", detail) },
    { field: amountField(430, 498), value: casillaAmount("11", detail) },
    { field: amountField(555, 498), value: casillaAmount("12", detail) },
    { field: amountField(555, 270), value: casillaAmount("28", detail) },
    { field: amountField(555, 221), value: casillaAmount("29", detail) },
    { field: amountField(280, 162), value: casillaAmount("30", detail) },
  ]
}
