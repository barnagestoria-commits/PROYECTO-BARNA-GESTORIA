import { generateAeatTxt, shouldOfferAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import {
  validateAeatSubmission,
  type AeatSubmissionValidationResult,
} from "@/lib/fiscal/aeat/validate-submission"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import { generateOfficialDraftPdf } from "@/lib/fiscal/official-pdf/generate-official-draft-pdf"
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
  const validation = validateAeatSubmission(detail, companyName, companyCif)
  const telematicFile = shouldOfferAeatTxt(detail)
    ? generateAeatTxt(detail, companyName, companyCif)
    : null

  let draftPdf: Buffer | null = null
  try {
    draftPdf = await generateOfficialDraftPdf(detail, companyName, companyCif)
  } catch {
    draftPdf = null
  }

  return {
    casillas: buildOfficialCasillaEntries(detail),
    telematicFile,
    validation,
    draftPdf,
    officialSource: getAeatModelOfficialSource(detail.modelCode),
  }
}
