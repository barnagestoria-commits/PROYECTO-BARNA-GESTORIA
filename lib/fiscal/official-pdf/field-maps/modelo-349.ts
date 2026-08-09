import type { OverlayTextField } from "@/lib/fiscal/official-pdf/overlay-utils"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"

function amountField(x: number, y: number, kind: "amount" | "integer" = "amount"): OverlayTextField {
  return { page: 0, x, y, align: "right", kind, eraseWidth: 80, eraseHeight: 14 }
}

export const MODELO_349_IDENTITY = {
  nif: { page: 0, x: 130, y: 667, eraseWidth: 90, eraseHeight: 14 },
  companyName: { page: 0, x: 360, y: 640, maxWidth: 250, eraseWidth: 250, eraseHeight: 14 },
  year: { page: 0, x: 544, y: 674, eraseWidth: 40, eraseHeight: 14 },
  period: { page: 0, x: 545, y: 649, eraseWidth: 24, eraseHeight: 14 },
} satisfies Record<string, OverlayTextField>

function casillaValue(detail: FiscalModelDetailResponse, code: string): number {
  return buildOfficialCasillaEntries(detail).find((entry) => entry.code === code)?.amount ?? 0
}

export function buildModelo349OverlayFields(
  detail: FiscalModelDetailResponse,
): Array<{ field: OverlayTextField; value: number }> {
  return [
    { field: amountField(555, 506, "integer"), value: casillaValue(detail, "01") },
    { field: amountField(555, 481), value: casillaValue(detail, "02") },
    { field: amountField(555, 459), value: casillaValue(detail, "03") },
  ]
}
