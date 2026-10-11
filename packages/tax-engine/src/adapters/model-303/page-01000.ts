import {
  formatAeatNumAmount,
  formatAeatSignedAmount,
  normalizeCompanyName,
  normalizeNif,
} from "../../amount-format"
import { createBlankRecord, recordToString, writeAt } from "../../record-builder"
import type { TaxReturnContext } from "../../types"
import {
  MODEL_303_PAGE_01000_FIELDS,
  MODEL_303_PAGE_01000_LENGTH,
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
  if (cuota71 < 0) return "C"
  return "N"
}

function yesNo(value: boolean | undefined): "1" | "2" {
  return value ? "1" : "2"
}

function lastPeriodFlag(period: string, value: boolean | undefined): "0" | "1" | "2" {
  if (period !== "4T") return "0"
  if (value === undefined) return "0"
  return value ? "1" : "2"
}

function formatField(spec: Model303FieldSpec, amount: number): string {
  if (spec.kind === "percent") return spec.constant ?? "00000"
  return spec.signed ? formatAeatSignedAmount(amount) : formatAeatNumAmount(amount)
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

  const options = context.model303 ?? {}
  writeAt(record, 109, yesNo(options.exclusivelyForal), 1)
  writeAt(record, 110, yesNo(options.registeredMonthlyRefund), 1)
  // Este adaptador solo genera régimen general; "3" significa NO (solo RG).
  writeAt(record, 111, "3", 1)
  writeAt(record, 112, yesNo(options.jointReturn), 1)
  writeAt(record, 113, yesNo(options.cashBasisSubject), 1)
  writeAt(record, 114, yesNo(options.cashBasisRecipient), 1)
  writeAt(record, 115, yesNo(options.specialProrataOption), 1)
  writeAt(record, 116, yesNo(options.specialProrataRevocation), 1)
  writeAt(record, 117, yesNo(Boolean(options.bankruptcy)), 1)
  if (options.bankruptcy) {
    writeAt(record, 118, options.bankruptcy.orderDate, 8)
    writeAt(record, 126, options.bankruptcy.type === "PRE" ? "1" : "2", 1)
  }
  writeAt(record, 127, yesNo(options.voluntarySii), 1)
  writeAt(record, 128, lastPeriodFlag(period, options.annualSummaryExempt), 1)
  writeAt(record, 129, lastPeriodFlag(period, options.annualOperationsNonZero), 1)
  // Nota 8: para periodos trimestrales el valor obligatorio es 0.
  writeAt(record, 130, "0", 1)

  for (const field of MODEL_303_PAGE_01000_FIELDS) {
    const amount = field.kind === "amount" ? casillas.get(field.casilla) ?? 0 : 0
    writeAt(record, field.position, formatField(field, amount), field.length)
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
