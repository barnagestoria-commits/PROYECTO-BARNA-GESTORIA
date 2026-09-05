import {
  buildModel303Filename,
  defaultTaxRuleEngine,
  exportModel303Dr303,
  getDefault303VersionKey,
  type TaxCasillaValue,
  type TaxFactSourceRef,
  type TaxReturnContext,
} from "@gestoria/tax-engine"
import { buildModel303CasillaValues } from "@/lib/fiscal/model-303/official-layout"
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
  const configuredDeveloperNif = process.env.AEAT_DEVELOPER_NIF?.trim()
  const clientNif = (companyCif ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase()
  const developerNif = configuredDeveloperNif || clientNif
  const softwareVersion = process.env.AEAT_PROGRAM_VERSION?.trim() || "0102"

  return {
    modelCode: "303",
    year: detail.year,
    period: quarterToPeriod(detail.quarter),
    companyNif: clientNif,
    companyName,
    versionKey: getDefault303VersionKey(detail.year, quarterToPeriod(detail.quarter)),
    model303: {
      exclusivelyForal: false,
      registeredMonthlyRefund: false,
      jointReturn: false,
      cashBasisSubject: false,
      cashBasisRecipient: false,
      specialProrataOption: false,
      specialProrataRevocation: false,
      voluntarySii: false,
    },
    software: developerNif
      ? {
          version: softwareVersion,
          developerNif,
        }
      : undefined,
  }
}

export function buildTaxEngine303Casillas(detail: FiscalModelDetailResponse): TaxCasillaValue[] {
  const values = buildModel303CasillaValues(detail)
  const sourcesForSections = (
    sections: FiscalModelDetailResponse["breakdown"],
  ): TaxFactSourceRef[] => {
    const byLineId = new Map<string, TaxFactSourceRef>()
    for (const section of sections) {
      for (const line of section.lines) {
        byLineId.set(line.lineId, {
          entryId: line.entryId,
          lineId: line.lineId,
          concept: line.concepto || line.entryConcept || section.label,
          accountCode: line.cuenta,
        })
      }
    }
    return [...byLineId.values()]
  }
  const allSources = sourcesForSections(detail.breakdown)
  const repercutidoSources = sourcesForSections(
    detail.breakdown.filter((section) =>
      /repercut|devengad/i.test(`${section.key} ${section.label}`),
    ),
  )
  const soportadoSources = sourcesForSections(
    detail.breakdown.filter((section) =>
      /soportad|deducible/i.test(`${section.key} ${section.label}`),
    ),
  )

  return defaultTaxRuleEngine.buildModel303Casillas(values).map((entry) => ({
    casilla: entry.casilla,
    amount: entry.amount,
    sources:
      Number.parseInt(entry.casilla, 10) <= 27
        ? repercutidoSources
        : Number.parseInt(entry.casilla, 10) <= 45
          ? soportadoSources
          : allSources,
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
