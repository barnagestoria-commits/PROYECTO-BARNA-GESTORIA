import {
  formatAeatNumAmount,
  formatAeatPercent,
  formatAeatSignedAmount,
  inferPercentFromBaseCuota,
  normalizeCompanyName,
  normalizeNif,
} from "../../amount-format"
import { createBlankRecord, recordToString, writeAt } from "../../record-builder"
import type { TaxReturnContext } from "../../types"
import {
  MODEL_303_PAGE_01000_FIELDS,
  MODEL_303_PAGE_01000_LENGTH,
  MODEL_303_PERCENT_PAIRS,
  type Model303FieldSpec,
} from "./field-map"

function quarterToPeriod(period: string): string {
  if (/^\dT$/.test(period)) return period
  if (period === "0A" || period === "annual") return "0A"
  return period
}

function resolveDeclarationType(cuota71: number, explicit?: TaxReturnContext["declarationType"]): string {
  if (explicit) return explicit
  if (cuota71 > 0) return "I"
  if (cuota71 < 0) return "G"
  return "N"
}

function cuotaForBase(baseCasilla: string, casillas: Map<string, number>): number {
  if (baseCasilla === "01") return casillas.get("03") ?? 0
  if (baseCasilla === "04") return casillas.get("06") ?? 0
  if (baseCasilla === "07") return casillas.get("09") ?? 0
  return 0
}

function writeAmountField(record: string[], spec: Model303FieldSpec, amount: number): void {
  const formatted = spec.signed ? formatAeatSignedAmount(amount) : formatAeatNumAmount(amount)
  writeAt(record, spec.position, formatted, spec.length)
}

export function buildModel303Page01000(
  context: TaxReturnContext,
  casillas: Map<string, number>,
): string {
  const record = createBlankRecord(MODEL_303_PAGE_01000_LENGTH)
  const period = quarterToPeriod(context.period)
  const cuota71 = casillas.get("71") ?? casillas.get("46") ?? 0

  writeAt(record, 1, "<T", 2)
  writeAt(record, 3, "303", 3)
  writeAt(record, 6, "01000", 5)
  writeAt(record, 11, ">", 1)
  writeAt(record, 12, " ", 1)
  writeAt(record, 13, resolveDeclarationType(cuota71, context.declarationType), 1)
  writeAt(record, 14, normalizeNif(context.companyNif), 9)
  writeAt(record, 23, normalizeCompanyName(context.companyName), 80)
  writeAt(record, 103, String(context.year).padStart(4, "0"), 4)
  writeAt(record, 107, period.padEnd(2, " ").slice(0, 2), 2)

  for (let pos = 109; pos <= 130; pos += 1) {
    writeAt(record, pos, "2", 1)
  }

  for (const field of MODEL_303_PAGE_01000_FIELDS) {
    if (field.kind === "percent") continue
    writeAmountField(record, field, casillas.get(field.casilla) ?? 0)
  }

  for (const pair of MODEL_303_PERCENT_PAIRS) {
    const spec = MODEL_303_PAGE_01000_FIELDS.find((field) => field.casilla === pair.percent)
    if (!spec) continue
    const base = casillas.get(pair.base) ?? 0
    const cuota = cuotaForBase(pair.base, casillas)
    const rate = base > 0 ? inferPercentFromBaseCuota(base, cuota) || pair.defaultRate : 0
    writeAt(record, spec.position, base > 0 ? formatAeatPercent(rate) : "00000", spec.length)
  }

  writeAt(record, 1570, "</T30301000>", 12)
  return recordToString(record)
}

export function buildModel303Page01000FromValues(
  context: TaxReturnContext,
  values: Array<{ casilla: string; amount: number }>,
): string {
  const map = new Map(values.map((value) => [value.casilla, value.amount]))
  return buildModel303Page01000(context, map)
}
