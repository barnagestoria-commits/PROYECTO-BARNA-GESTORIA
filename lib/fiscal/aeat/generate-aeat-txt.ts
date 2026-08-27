import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"
import {
  generateLegacyAeatTxt,
  LEGACY_AEAT_RECORD_LENGTH,
  supportsLegacyAeatTxt,
} from "@/lib/fiscal/aeat/generate-aeat-txt-legacy"
import {
  buildAeat303Filename,
  generateAeatTxt303ViaTaxEngine,
} from "@/lib/fiscal/aeat/tax-engine-bridge"

function periodLabelForFile(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "0A"
  return `${quarter}T`
}

export function buildAeatTxtFilename(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  if (detail.modelCode === "303") {
    return buildAeat303Filename(detail, companyCif)
  }

  const nif = (companyCif ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 9).padEnd(9, " ").trim() || "SINNIF"
  const period = periodLabelForFile(detail.quarter)
  return `${detail.modelCode}${detail.year}${period}_${nif}.txt`
}

export function generateAeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  if (detail.modelCode === "303") {
    return generateAeatTxt303ViaTaxEngine(detail, companyName, companyCif)
  }

  return generateLegacyAeatTxt(detail, companyName, companyCif)
}

export function supportsAeatTxtImport(model: FiscalModelId): boolean {
  return model === "303" || supportsLegacyAeatTxt(model)
}

export function shouldOfferAeatTxt(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "quarter">,
): boolean {
  if (detail.modelCode === "303") {
    return detail.quarter !== "annual"
  }

  const annualModels: FiscalModelId[] = ["180", "190", "347", "390"]
  if (annualModels.includes(detail.modelCode)) return detail.quarter === "annual"
  return detail.quarter !== "annual" && supportsLegacyAeatTxt(detail.modelCode)
}

/** Longitud BOE legacy (500). El 303 usa diseño DR303 variable. */
export const AEAT_RECORD_LENGTH = LEGACY_AEAT_RECORD_LENGTH

export function usesDr303Envelope(modelCode: FiscalModelId): boolean {
  return modelCode === "303"
}
