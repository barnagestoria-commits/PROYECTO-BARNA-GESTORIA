import { aggregateCasillasByCode } from "../../ledger/tax-fact-ledger"
import type { TaxCasillaValue, TaxExportArtifact, TaxReturnContext, TaxValidationResult } from "../../types"
import { buildModel303Dr303File, buildModel303Filename } from "./envelope"
import { validateModel303Export } from "./validate"

export interface Model303AdapterInput {
  context: TaxReturnContext
  casillas: TaxCasillaValue[]
}

export function exportModel303Dr303(input: Model303AdapterInput): TaxExportArtifact {
  const casillaMap = aggregateCasillasByCode(input.casillas)
  const contentString = buildModel303Dr303File(input.context, casillaMap)
  const content = Buffer.from(contentString, "latin1")
  const validation = validateModel303Export(contentString, input.context)

  return {
    filename: buildModel303Filename(input.context),
    content,
    mimeType: "text/plain",
    format: "dr303-envelope",
    byteLength: content.byteLength,
    validation,
  }
}

export function isModel303Supported(context: Pick<TaxReturnContext, "modelCode" | "year">): boolean {
  return context.modelCode === "303" && context.year >= 2024
}

export function buildModel303ValidationOnly(
  input: Model303AdapterInput,
): TaxValidationResult {
  const casillaMap = aggregateCasillasByCode(input.casillas)
  const contentString = buildModel303Dr303File(input.context, casillaMap)
  return validateModel303Export(contentString, input.context)
}
