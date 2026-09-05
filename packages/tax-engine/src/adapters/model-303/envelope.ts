import { normalizeNif } from "../../amount-format"
import { createBlankRecord, recordToString, writeAt } from "../../record-builder"
import type { TaxReturnContext } from "../../types"
import { buildModel303Page01000 } from "./page-01000"
import { buildModel303Page03000 } from "./page-03000"

export const TAX_ENGINE_PROGRAM_VERSION = "0102"

const AUX_BLOCK_LENGTH = 311

function quarterToPeriod(period: string): string {
  if (/^\dT$/.test(period)) return period
  if (period === "annual" || period === "0A") return "0A"
  return period
}

export function buildModel303EnvelopeHeader(context: TaxReturnContext): string {
  const period = quarterToPeriod(context.period)
  const opening = `<T3030${context.year}${period}0000>`
  const aux = createBlankRecord(AUX_BLOCK_LENGTH)
  writeAt(aux, 1, "<AUX>", 5)
  writeAt(aux, 76, context.software?.version ?? TAX_ENGINE_PROGRAM_VERSION, 4)
  writeAt(aux, 84, normalizeNif(context.software?.developerNif), 9)
  writeAt(aux, 306, "</AUX>", 6)
  return opening + recordToString(aux)
}

export function buildModel303EnvelopeFooter(context: TaxReturnContext): string {
  const period = quarterToPeriod(context.period)
  return `</T3030${context.year}${period}0000>`
}

export function buildModel303Dr303File(
  context: TaxReturnContext,
  casillas: Map<string, number>,
): string {
  const page01000 = buildModel303Page01000(context, casillas)
  const page03000 = buildModel303Page03000(casillas)
  return buildModel303EnvelopeHeader(context) + page01000 + page03000 + buildModel303EnvelopeFooter(context)
}

export function buildModel303Filename(context: TaxReturnContext): string {
  const period = quarterToPeriod(context.period)
  const nif = normalizeNif(context.companyNif).trim() || "SINNIF"
  return `303${context.year}${period}_${nif}.303`
}
