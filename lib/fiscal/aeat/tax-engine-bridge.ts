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
import type { CompanySiiMode } from "@/lib/company/sii"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

function filePeriod(detail: Pick<FiscalModelDetailResponse, "quarter" | "month">): string {
  if (detail.month) return String(detail.month).padStart(2, "0")
  if (detail.quarter === "annual") return "0A"
  return `${detail.quarter}T`
}

export interface Model303FileOptions {
  taxDirectDebitIban?: string | null
  cashBasisSubject?: boolean
  cashBasisRecipient?: boolean
  voluntarySii?: boolean
  siiMode?: CompanySiiMode
}

export function buildTaxEngine303Context(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter" | "month">,
  companyName: string,
  companyCif: string | null | undefined,
  options?: Model303FileOptions,
): TaxReturnContext {
  const configuredDeveloperNif = process.env.AEAT_DEVELOPER_NIF?.trim()
  const clientNif = (companyCif ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase()
  const developerNif = configuredDeveloperNif || clientNif
  const softwareVersion = process.env.AEAT_PROGRAM_VERSION?.trim() || "0102"
  const period = filePeriod(detail)
  const lastPeriod = period === "4T" || period === "12"

  return {
    modelCode: "303",
    year: detail.year,
    period,
    companyNif: clientNif,
    companyName,
    versionKey: getDefault303VersionKey(detail.year, period),
    model303: {
      exclusivelyForal: false,
      registeredMonthlyRefund: false,
      jointReturn: false,
      cashBasisSubject: options?.cashBasisSubject ?? false,
      cashBasisRecipient: options?.cashBasisRecipient ?? false,
      specialProrataOption: false,
      specialProrataRevocation: false,
      voluntarySii: options?.voluntarySii ?? false,
      siiSubject:
        options?.siiMode === "OBLIGATORIO" || options?.siiMode === "VOLUNTARIO",
      ...(lastPeriod
        ? { annualSummaryExempt: false, annualOperationsNonZero: true }
        : {}),
    },
    software: developerNif
      ? {
          version: softwareVersion,
          developerNif,
        }
      : undefined,
    taxDirectDebitIban: options?.taxDirectDebitIban || null,
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
  options?: Model303FileOptions,
): Buffer {
  const context = buildTaxEngine303Context(detail, companyName, companyCif, options)
  const casillas = buildTaxEngine303Casillas(detail)
  const artifact = exportModel303Dr303({ context, casillas })
  return artifact.content
}

export function buildAeat303Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter" | "month">,
  companyCif: string | null | undefined,
): string {
  const context = buildTaxEngine303Context(
    { ...detail, modelCode: "303" },
    "",
    companyCif,
  )
  return buildModel303Filename(context)
}
