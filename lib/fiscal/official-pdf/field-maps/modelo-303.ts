import type { OverlayTextField } from "@/lib/fiscal/official-pdf/overlay-utils"
import type { Model303CasillaValues } from "@/lib/fiscal/model-303/official-layout"
import type { TaxCasillaValue } from "@gestoria/tax-engine"

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
  return buildModelo303OverlayFieldsFromCasillas([
    { casilla: "01", amount: values.base01 },
    { casilla: "03", amount: values.cuota03 },
    { casilla: "04", amount: values.base04 },
    { casilla: "06", amount: values.cuota06 },
    { casilla: "07", amount: values.base07 },
    { casilla: "09", amount: values.cuota09 },
    { casilla: "10", amount: values.base10 },
    { casilla: "11", amount: values.cuota11 },
    { casilla: "12", amount: values.base12 },
    { casilla: "13", amount: values.cuota13 },
    { casilla: "27", amount: values.cuota27 },
    { casilla: "28", amount: values.base28 },
    { casilla: "29", amount: values.cuota29 },
    { casilla: "30", amount: values.base30 },
    { casilla: "31", amount: values.cuota31 },
    { casilla: "32", amount: values.base32 },
    { casilla: "33", amount: values.cuota33 },
    { casilla: "34", amount: values.base34 },
    { casilla: "35", amount: values.cuota35 },
    { casilla: "36", amount: values.base36 },
    { casilla: "37", amount: values.cuota37 },
    { casilla: "38", amount: values.base38 },
    { casilla: "39", amount: values.cuota39 },
    { casilla: "45", amount: values.cuota45 },
    { casilla: "46", amount: values.cuota46 },
    { casilla: "110", amount: values.cuota110 },
    { casilla: "71", amount: values.cuota71 },
  ])
}

export function buildModelo303OverlayFieldsFromCasillas(
  casillas: Pick<TaxCasillaValue, "casilla" | "amount">[],
): Array<{ field: OverlayTextField; value: number }> {
  const values = new Map(casillas.map((item) => [item.casilla, item.amount]))
  const amount = (casilla: string) => values.get(casilla) ?? 0

  return [
    { field: amountField(0, 392, 346), value: amount("01") },
    { field: amountField(0, 556, 346), value: amount("03") },
    { field: amountField(0, 392, 334), value: amount("04") },
    { field: amountField(0, 556, 334), value: amount("06") },
    { field: amountField(0, 392, 322), value: amount("07") },
    { field: amountField(0, 556, 322), value: amount("09") },
    { field: amountField(0, 392, 310), value: amount("10") },
    { field: amountField(0, 556, 310), value: amount("11") },
    { field: amountField(0, 392, 298), value: amount("12") },
    { field: amountField(0, 556, 298), value: amount("13") },
    { field: amountField(0, 556, 222), value: amount("27") },
    { field: amountField(0, 456, 188), value: amount("28") },
    { field: amountField(0, 556, 188), value: amount("29") },
    { field: amountField(0, 456, 140), value: amount("30") },
    { field: amountField(0, 556, 140), value: amount("31") },
    { field: amountField(0, 456, 128), value: amount("32") },
    { field: amountField(0, 556, 128), value: amount("33") },
    { field: amountField(0, 456, 116), value: amount("34") },
    { field: amountField(0, 556, 116), value: amount("35") },
    { field: amountField(0, 456, 104), value: amount("36") },
    { field: amountField(0, 556, 104), value: amount("37") },
    { field: amountField(0, 456, 92), value: amount("38") },
    { field: amountField(0, 556, 92), value: amount("39") },
    { field: amountField(0, 556, 62), value: amount("45") },
    { field: amountField(0, 556, 48), value: amount("46") },
    { field: amountField(1, 557, 486), value: amount("110") },
    { field: amountField(1, 558, 443), value: amount("71") },
    { field: amountField(2, 177, 645), value: amount("71") },
  ]
}
