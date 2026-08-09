import type { OverlayTextField } from "@/lib/fiscal/official-pdf/overlay-utils"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"

/** Posiciones genéricas en la primera página del formulario para modelos sin mapa detallado. */
export const GENERIC_IDENTITY = {
  nif: { page: 0, x: 130, y: 667, eraseWidth: 90, eraseHeight: 14 },
  companyName: { page: 0, x: 320, y: 640, maxWidth: 250, eraseWidth: 250, eraseHeight: 14 },
  year: { page: 0, x: 470, y: 710, eraseWidth: 40, eraseHeight: 14 },
  period: { page: 0, x: 545, y: 710, eraseWidth: 24, eraseHeight: 14 },
} satisfies Record<string, OverlayTextField>

export function buildGenericOverlayFields(
  detail: FiscalModelDetailResponse,
): Array<{ field: OverlayTextField; value: number }> {
  const entries = buildOfficialCasillaEntries(detail)
  const startY = 520
  const step = 18
  return entries.slice(0, 12).map((entry, index) => ({
    field: {
      page: 0,
      x: 555,
      y: startY - index * step,
      align: "right" as const,
      kind: entry.code.length <= 2 && entry.amount < 1000 && Number.isInteger(entry.amount) ? "integer" : "amount",
      eraseWidth: 80,
      eraseHeight: 14,
    },
    value: entry.amount,
  }))
}
