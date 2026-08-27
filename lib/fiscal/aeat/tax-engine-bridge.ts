import {
  buildModel303Filename,
  exportModel303Dr303,
  getDefault303VersionKey,
  type TaxCasillaValue,
  type TaxReturnContext,
} from "@gestoria/tax-engine"
import {
  buildModel303CasillaValues,
  model303CasillaEntries,
} from "@/lib/fiscal/model-303/official-layout"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

function quarterToPeriod(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "0A"
  return `${quarter}T`
}

export function buildTaxEngine303Context(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter">,
  companyName: string,
  companyCif: string | null | undefined,
): TaxReturnContext {
  return {
    modelCode: "303",
    year: detail.year,
    period: quarterToPeriod(detail.quarter),
    companyNif: companyCif ?? "",
    companyName,
    versionKey: getDefault303VersionKey(detail.year, quarterToPeriod(detail.quarter)),
  }
}

export function buildTaxEngine303Casillas(detail: FiscalModelDetailResponse): TaxCasillaValue[] {
  const values = buildModel303CasillaValues(detail)
  return model303CasillaEntries(values).map((entry) => ({
    casilla: entry.code,
    amount: entry.amount,
  }))
}

export function generateAeatTxt303ViaTaxEngine(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const context = buildTaxEngine303Context(detail, companyName, companyCif)
  const casillas = buildTaxEngine303Casillas(detail)
  const artifact = exportModel303Dr303({ context, casillas })
  return artifact.content
}

export function buildAeat303Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const context = buildTaxEngine303Context(
    { ...detail, modelCode: "303" },
    "",
    companyCif,
  )
  return buildModel303Filename(context)
}
