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

/**
 * Coordenadas calibradas sobre cajas del impreso oficial (modelo-303.pdf).
 * Origen pdf-lib: esquina inferior izquierda.
 */
export const MODELO_303_IDENTITY = {
  nif: { page: 0, x: 42, y: 686, eraseWidth: 44, eraseHeight: 14 },
  companyName: { page: 0, x: 148, y: 686, maxWidth: 250, eraseWidth: 250, eraseHeight: 14 },
  year: { page: 0, x: 491, y: 715, eraseWidth: 45, eraseHeight: 14 },
  period: { page: 0, x: 553, y: 715, eraseWidth: 24, eraseHeight: 14 },
} satisfies Record<string, OverlayTextField>

export function buildModelo303OverlayFields(
  values: Model303CasillaValues,
): Array<{ field: OverlayTextField; value: number }> {
  return [
    { field: amountField(0, 392, 346), value: values.base01 },
    { field: amountField(0, 556, 346), value: values.cuota03 },
    { field: amountField(0, 392, 334), value: values.base04 },
    { field: amountField(0, 556, 334), value: values.cuota06 },
    { field: amountField(0, 392, 322), value: values.base07 },
    { field: amountField(0, 556, 322), value: values.cuota09 },
    { field: amountField(0, 392, 310), value: values.base10 },
    { field: amountField(0, 556, 310), value: values.cuota11 },
    { field: amountField(0, 392, 298), value: values.base12 },
    { field: amountField(0, 556, 298), value: values.cuota13 },
    { field: amountField(0, 556, 222), value: values.cuota27 },
    { field: amountField(0, 456, 188), value: values.base28 },
    { field: amountField(0, 556, 188), value: values.cuota29 },
    { field: amountField(0, 456, 140), value: values.base30 },
    { field: amountField(0, 556, 140), value: values.cuota31 },
    { field: amountField(0, 456, 128), value: values.base32 },
    { field: amountField(0, 556, 128), value: values.cuota33 },
    { field: amountField(0, 456, 116), value: values.base34 },
    { field: amountField(0, 556, 116), value: values.cuota35 },
    { field: amountField(0, 456, 104), value: values.base36 },
    { field: amountField(0, 556, 104), value: values.cuota37 },
    { field: amountField(0, 456, 92), value: values.base38 },
    { field: amountField(0, 556, 92), value: values.cuota39 },
    { field: amountField(0, 556, 62), value: values.cuota45 },
    { field: amountField(0, 556, 48), value: values.cuota46 },
    { field: amountField(1, 557, 486), value: values.cuota110 },
    { field: amountField(1, 558, 443), value: values.cuota71 },
    { field: amountField(2, 177, 645), value: values.cuota71 },
  ]
}
