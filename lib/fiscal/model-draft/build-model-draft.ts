import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { FiscalModelDraft } from "@/lib/fiscal/model-draft/types"
import { DRAFT_SUPPORTED_MODELS } from "@/lib/fiscal/model-draft/types"
import {
  buildOfficialModelSections,
  resolveDraftResultAmount,
} from "@/lib/fiscal/official-layouts"

export function buildFiscalModelDraft(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): FiscalModelDraft {
  const sections = buildOfficialModelSections(detail)

  const hasExistingLiquidation = detail.breakdown.some(
    (section) => section.key === "liquidacion" || section.key === "nrc-pago",
  )

  return {
    modelCode: detail.modelCode,
    modelLabel: detail.modelLabel,
    year: detail.year,
    quarter: detail.quarter,
    periodLabel: detail.periodLabel,
    nif: (companyCif ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase() || "—",
    companyName,
    status: detail.status,
    statusLabel: detail.statusLabel,
    sections,
    resultAmount: resolveDraftResultAmount(detail),
    supportsGenerateEntry:
      DRAFT_SUPPORTED_MODELS.has(detail.modelCode) &&
      detail.quarter !== "annual" &&
      (detail.modelCode === "303" || detail.modelCode === "111"),
    hasExistingLiquidation,
  }
}
