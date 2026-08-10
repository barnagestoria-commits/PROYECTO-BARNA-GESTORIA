import type { OverlayTextField } from "@/lib/fiscal/official-pdf/overlay-utils"
import type { Model303CasillaValues } from "@/lib/fiscal/model-303/official-layout"

function amountField(
  page: number,
  x: number,
  y: number,
  kind: "amount" | "integer" = "amount",
  eraseWidth = 88,
): OverlayTextField {
  return { page, x, y, align: "right", kind, eraseWidth, eraseHeight: 14 }
}

/** Coordenadas calibradas sobre plantilla AEAT modelo 303 (justificante oficial). */
export const MODELO_303_IDENTITY = {
  nif: { page: 0, x: 40, y: 681, eraseWidth: 88, eraseHeight: 14 },
  companyName: { page: 0, x: 130, y: 681, maxWidth: 300, eraseWidth: 300, eraseHeight: 14 },
  year: { page: 0, x: 485, y: 710, eraseWidth: 36, eraseHeight: 14 },
  period: { page: 0, x: 530, y: 710, eraseWidth: 28, eraseHeight: 14 },
} satisfies Record<string, OverlayTextField>

export function buildModelo303OverlayFields(
  values: Model303CasillaValues,
): Array<{ field: OverlayTextField; value: number }> {
  return [
    { field: amountField(0, 431, 375), value: values.base01 },
    { field: amountField(0, 511, 375), value: values.cuota03 },
    { field: amountField(0, 431, 351), value: values.base04 },
    { field: amountField(0, 511, 351), value: values.cuota06 },
    { field: amountField(0, 339, 339), value: values.base07 },
    { field: amountField(0, 511, 339), value: values.cuota09 },
    { field: amountField(0, 364, 327), value: values.base10 },
    { field: amountField(0, 511, 327), value: values.cuota11 },
    { field: amountField(0, 364, 315), value: values.base12 },
    { field: amountField(0, 511, 315), value: values.cuota13 },
    { field: amountField(0, 511, 216), value: values.cuota27 },
    { field: amountField(0, 411, 181), value: values.base28 },
    { field: amountField(0, 511, 181), value: values.cuota29 },
    { field: amountField(0, 431, 171), value: values.base30 },
    { field: amountField(0, 511, 171), value: values.cuota31 },
    { field: amountField(0, 431, 159), value: values.base32 },
    { field: amountField(0, 511, 159), value: values.cuota33 },
    { field: amountField(0, 431, 147), value: values.base34 },
    { field: amountField(0, 511, 147), value: values.cuota35 },
    { field: amountField(0, 431, 134), value: values.base36 },
    { field: amountField(0, 511, 134), value: values.cuota37 },
    { field: amountField(0, 431, 122), value: values.base38 },
    { field: amountField(0, 511, 122), value: values.cuota39 },
    { field: amountField(0, 511, 55), value: values.cuota45 },
    { field: amountField(0, 511, 29), value: values.cuota46 },
    { field: amountField(1, 517, 496), value: values.cuota110 },
    { field: amountField(1, 513, 387), value: values.cuota71 },
    { field: amountField(2, 132, 638), value: values.cuota71 },
  ]
}
