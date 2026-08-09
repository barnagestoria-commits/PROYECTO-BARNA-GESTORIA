import type { OverlayTextField } from "@/lib/fiscal/official-pdf/overlay-utils"
import type { Model303CasillaValues } from "@/lib/fiscal/model-303/official-layout"

function amountField(
  page: number,
  x: number,
  y: number,
  kind: "amount" | "integer" = "amount",
): OverlayTextField {
  return { page, x, y, align: "right", kind, eraseWidth: 80, eraseHeight: 14 }
}

export const MODELO_303_IDENTITY = {
  nif: { page: 0, x: 130, y: 681, eraseWidth: 90, eraseHeight: 14 },
  companyName: { page: 0, x: 365, y: 680, maxWidth: 260, eraseWidth: 260, eraseHeight: 14 },
  year: { page: 0, x: 472, y: 710, eraseWidth: 40, eraseHeight: 14 },
  period: { page: 0, x: 545, y: 710, eraseWidth: 24, eraseHeight: 14 },
} satisfies Record<string, OverlayTextField>

export function buildModelo303OverlayFields(
  values: Model303CasillaValues,
): Array<{ field: OverlayTextField; value: number }> {
  return [
    { field: amountField(0, 430, 375), value: values.base01 },
    { field: amountField(0, 555, 375), value: values.cuota03 },
    { field: amountField(0, 430, 351), value: values.base04 },
    { field: amountField(0, 555, 351), value: values.cuota06 },
    { field: amountField(0, 430, 339), value: values.base07 },
    { field: amountField(0, 555, 339), value: values.cuota09 },
    { field: amountField(0, 430, 327), value: values.base10 },
    { field: amountField(0, 555, 327), value: values.cuota11 },
    { field: amountField(0, 430, 315), value: values.base12 },
    { field: amountField(0, 555, 315), value: values.cuota13 },
    { field: amountField(0, 555, 217), value: values.cuota27 },
    { field: amountField(0, 455, 181), value: values.base28 },
    { field: amountField(0, 555, 181), value: values.cuota29 },
    { field: amountField(0, 430, 171), value: values.base30 },
    { field: amountField(0, 555, 171), value: values.cuota31 },
    { field: amountField(0, 430, 159), value: values.base32 },
    { field: amountField(0, 555, 159), value: values.cuota33 },
    { field: amountField(0, 430, 147), value: values.base34 },
    { field: amountField(0, 555, 147), value: values.cuota35 },
    { field: amountField(0, 430, 134), value: values.base36 },
    { field: amountField(0, 555, 134), value: values.cuota37 },
    { field: amountField(0, 430, 123), value: values.base38 },
    { field: amountField(0, 555, 123), value: values.cuota39 },
    { field: amountField(0, 555, 55), value: values.cuota45 },
    { field: amountField(0, 555, 29), value: values.cuota46 },
    { field: amountField(1, 555, 496), value: values.cuota110 },
    { field: amountField(1, 555, 387), value: values.cuota71 },
    { field: amountField(2, 177, 638), value: values.cuota71 },
  ]
}
