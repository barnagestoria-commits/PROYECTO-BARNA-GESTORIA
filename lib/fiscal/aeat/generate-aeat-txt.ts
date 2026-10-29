import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"
import {
  generateLegacyAeatTxt,
  LEGACY_AEAT_RECORD_LENGTH,
  supportsLegacyAeatTxt,
} from "@/lib/fiscal/aeat/generate-aeat-txt-legacy"
import {
  buildModel111Filename,
  generateModel111AeatTxt,
  model111FilePeriod,
} from "@/lib/fiscal/aeat/generate-aeat-txt-111"
import {
  buildModel130Filename,
  generateModel130AeatTxt,
} from "@/lib/fiscal/aeat/generate-aeat-txt-130"
import {
  buildModel202Filename,
  generateModel202AeatTxt,
  model202FilePeriod,
} from "@/lib/fiscal/aeat/generate-aeat-txt-202"
import {
  buildAeat303Filename,
  generateAeatTxt303ViaTaxEngine,
  type Model303FileOptions,
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

  if (detail.modelCode === "111") {
    return buildModel111Filename(detail, companyCif)
  }

  if (detail.modelCode === "130") {
    return buildModel130Filename(detail, companyCif)
  }

  if (detail.modelCode === "202") {
    return buildModel202Filename(detail, companyCif)
  }

  const nif = (companyCif ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 9).padEnd(9, " ").trim() || "SINNIF"
  const period = periodLabelForFile(detail.quarter)
  return `${detail.modelCode}${detail.year}${period}_${nif}.txt`
}

export function generateAeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
  options?: Model303FileOptions,
): Buffer {
  if (detail.modelCode === "303") {
    return generateAeatTxt303ViaTaxEngine(detail, companyName, companyCif, options)
  }

  if (detail.modelCode === "111") {
    return generateModel111AeatTxt(detail, companyName, companyCif)
  }

  if (detail.modelCode === "130") {
    return generateModel130AeatTxt(detail, companyName, companyCif)
  }

  if (detail.modelCode === "202") {
    return generateModel202AeatTxt(detail, companyName, companyCif)
  }

  return generateLegacyAeatTxt(detail, companyName, companyCif)
}

export function supportsAeatTxtImport(model: FiscalModelId): boolean {
  return model === "111" || model === "303" || model === "202" || supportsLegacyAeatTxt(model)
}

export function shouldOfferAeatTxt(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "quarter">,
): boolean {
  if (detail.modelCode === "111") {
    return model111FilePeriod(detail.quarter) !== null
  }

  if (detail.modelCode === "303") {
    return detail.quarter !== "annual"
  }

  if (detail.modelCode === "202") {
    return model202FilePeriod(detail.quarter) !== null
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

export function usesDr111Envelope(modelCode: FiscalModelId): boolean {
  return modelCode === "111"
}

export function usesDr130Envelope(modelCode: FiscalModelId): boolean {
  return modelCode === "130"
}

export function usesDr202Envelope(modelCode: FiscalModelId): boolean {
  return modelCode === "202"
}
