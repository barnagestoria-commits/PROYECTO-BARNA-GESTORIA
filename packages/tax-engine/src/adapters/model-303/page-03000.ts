import { formatAeatNumAmount, formatAeatPercent, formatAeatSignedAmount } from "../../amount-format"
import { createBlankRecord, recordToString, writeAt } from "../../record-builder"
import { MODEL_303_PAGE_03000_FIELDS, MODEL_303_PAGE_03000_LENGTH } from "./field-map"

export function buildModel303Page03000(casillas: Map<string, number>): string {
  const record = createBlankRecord(MODEL_303_PAGE_03000_LENGTH)
  const cuota46 = casillas.get("46") ?? 0
  const cuota71 = casillas.get("71") ?? cuota46
  const cuota110 = casillas.get("110") ?? 0

  writeAt(record, 1, "<T", 2)
  writeAt(record, 3, "303", 3)
  writeAt(record, 6, "03000", 5)
  writeAt(record, 11, ">", 1)

  writeAt(record, 216, formatAeatPercent(100), 5)

  for (const field of MODEL_303_PAGE_03000_FIELDS) {
    if (field.kind === "percent") continue
    let amount = casillas.get(field.casilla) ?? 0
    if (field.casilla === "64" || field.casilla === "66" || field.casilla === "69") {
      amount = cuota46
    }
    if (field.casilla === "71") {
      amount = cuota71
    }
    if (field.casilla === "110") {
      amount = cuota110
    }
    const formatted = field.signed ? formatAeatSignedAmount(amount) : formatAeatNumAmount(amount)
    writeAt(record, field.position, formatted, field.length)
  }

  const activityCasillas = [
    "01", "03", "04", "06", "07", "09", "10", "11", "12", "13",
    "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  ]
  const hasActivity = activityCasillas.some((casilla) => (casillas.get(casilla) ?? 0) !== 0)
  writeAt(record, 425, hasActivity ? " " : "X", 1)

  writeAt(record, 1006, "</T30303000>", 12)
  return recordToString(record)
}
