import { generateAeatTxt, shouldOfferAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import { validateWithOfficialAeatPipeline } from "@/lib/fiscal/aeat/sandbox-client"
import type { AeatSubmissionValidationResult } from "@/lib/fiscal/aeat/validate-submission"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import { generateOfficialDraftPdf } from "@/lib/fiscal/official-pdf/generate-official-draft-pdf"
import {
  buildModel303EngineResult,
  summarizeModel303EngineResult,
  type Model303EngineSummary,
} from "@/lib/fiscal/model-303/engine-service"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export interface OfficialAeatDraftBundle {
  /** Casillas oficiales calculadas desde contabilidad. */
  casillas: Array<{ code: string; amount: number }>
  /** Fichero BOE (.txt / extensión oficial) listo para importar en la sede. */
  telematicFile: Buffer | null
  /** Validación contra diseño de registro AEAT. */
  validation: AeatSubmissionValidationResult
  /** PDF visual del borrador (plantilla oficial + overlay). */
  draftPdf: Buffer | null
  officialSource: ReturnType<typeof getAeatModelOfficialSource>
  /** Estado serializable del motor DR303 usado por UI y auditoría. */
  engineSummary: Model303EngineSummary | null
}

/**
 * Pipeline unificado estilo gestoría (A3 / Wolters):
 * contabilidad → casillas oficiales → validación BOE → PDF borrador.
 */
export async function buildOfficialAeatDraftBundle(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Promise<OfficialAeatDraftBundle> {
  const validation = await validateWithOfficialAeatPipeline(detail, companyName, companyCif)
  const telematicFile = shouldOfferAeatTxt(detail)
    ? generateAeatTxt(detail, companyName, companyCif)
    : null

  let draftPdf: Buffer | null = null
  try {
    draftPdf = await generateOfficialDraftPdf(detail, companyName, companyCif)
  } catch {
    draftPdf = null
  }

  let engineSummary: Model303EngineSummary | null = null
  if (detail.modelCode === "303" && detail.quarter !== "annual") {
    try {
      engineSummary = summarizeModel303EngineResult(
        buildModel303EngineResult(detail, companyName, companyCif),
      )
    } catch {
      engineSummary = null
    }
  }

  return {
    casillas: buildOfficialCasillaEntries(detail),
    telematicFile,
    validation,
    draftPdf,
    officialSource: getAeatModelOfficialSource(detail.modelCode),
    engineSummary,
  }
}
