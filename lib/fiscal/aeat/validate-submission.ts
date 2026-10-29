import {
  buildAeatTxtFilename,
  generateAeatTxt,
  shouldOfferAeatTxt,
  usesDr111Envelope,
  usesDr130Envelope,
  usesDr202Envelope,
  usesDr303Envelope,
} from "@/lib/fiscal/aeat/generate-aeat-txt"
import { MODEL_111_PAGE_LENGTH, model111FilePeriod } from "@/lib/fiscal/aeat/generate-aeat-txt-111"
import { MODEL_130_PAGE_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt-130"
import {
  MODEL_202_PAGE1_LENGTH,
  MODEL_202_PAGE2_LENGTH,
  model202Cnae,
  model202FilePeriod,
} from "@/lib/fiscal/aeat/generate-aeat-txt-202"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import {
  buildTaxEngine303Casillas,
  buildTaxEngine303Context,
  type Model303FileOptions,
} from "@/lib/fiscal/aeat/tax-engine-bridge"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import { buildModel303ValidationOnly } from "@gestoria/tax-engine"
import { LEGACY_AEAT_RECORD_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt-legacy"

export interface AeatSubmissionValidationIssue {
  code: string
  message: string
  severity: "error" | "warning"
}

export interface AeatSubmissionValidationResult {
  valid: boolean
  modelCode: string
  recordCount: number
  casillaCount: number
  filename: string
  issues: AeatSubmissionValidationIssue[]
}

function validateLegacyRecordLines(content: string): AeatSubmissionValidationIssue[] {
  const issues: AeatSubmissionValidationIssue[] = []
  const lines = content.split(/\r?\n/).filter(Boolean)

  if (lines.length === 0) {
    issues.push({
      code: "EMPTY_FILE",
      message: "El fichero de presentación no contiene registros.",
      severity: "error",
    })
    return issues
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (line.length !== LEGACY_AEAT_RECORD_LENGTH) {
      issues.push({
        code: "RECORD_LENGTH",
        message: `Registro ${index + 1}: longitud ${line.length}, se esperaban ${LEGACY_AEAT_RECORD_LENGTH} posiciones BOE legacy.`,
        severity: "error",
      })
    }
  }

  const firstType = lines[0]?.[0]
  const lastType = lines[lines.length - 1]?.[0]
  if (firstType !== "1") {
    issues.push({
      code: "MISSING_HEADER",
      message: "Falta el registro de identificación (tipo 1) al inicio del fichero.",
      severity: "error",
    })
  }
  if (lastType !== "9") {
    issues.push({
      code: "MISSING_CLOSER",
      message: "Falta el registro de cierre (tipo 9) al final del fichero.",
      severity: "error",
    })
  }

  return issues
}

export function validateAeatSubmission(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
  options?: Model303FileOptions,
): AeatSubmissionValidationResult {
  const issues: AeatSubmissionValidationIssue[] = []
  const source = getAeatModelOfficialSource(detail.modelCode)

  if (!source) {
    issues.push({
      code: "UNKNOWN_MODEL",
      message: `No hay metadatos oficiales registrados para el modelo ${detail.modelCode}.`,
      severity: "warning",
    })
  }

  if (!shouldOfferAeatTxt(detail)) {
    issues.push({
      code: "PERIOD_NOT_APPLICABLE",
      message: "El periodo seleccionado no admite fichero telemático BOE para este modelo.",
      severity: "error",
    })
    return {
      valid: false,
      modelCode: detail.modelCode,
      recordCount: 0,
      casillaCount: 0,
      filename: buildAeatTxtFilename(detail, companyCif),
      issues,
    }
  }

  const casillas = buildOfficialCasillaEntries(detail)
  const buffer = generateAeatTxt(detail, companyName, companyCif, options)
  const content = buffer.toString("latin1")

  if (usesDr130Envelope(detail.modelCode)) {
    const opening = `<T1300${detail.year}${detail.quarter}T0000>`
    const pageStart = content.indexOf("<T13001000>")
    const page = pageStart >= 0 ? content.slice(pageStart, pageStart + MODEL_130_PAGE_LENGTH) : ""
    if (!content.startsWith(opening) || !content.includes("<AUX>") || !content.includes("</AUX>")) {
      issues.push({
        code: "DR130_ENVELOPE",
        message: "El fichero del modelo 130 no tiene la envolvente <T1300…> ni el bloque <AUX> del diseño DR130.",
        severity: "error",
      })
    }
    if (page.length !== MODEL_130_PAGE_LENGTH || !page.endsWith("</T13001000>")) {
      issues.push({
        code: "DR130_PAGE",
        message: `La página 01 del modelo 130 debe ocupar ${MODEL_130_PAGE_LENGTH} posiciones.`,
        severity: "error",
      })
    }
    if (!content.endsWith(`</T1300${detail.year}${detail.quarter}T0000>`)) {
      issues.push({
        code: "DR130_CLOSING",
        message: "Falta el cierre </T1300…> del fichero del modelo 130.",
        severity: "error",
      })
    }
    const hasErrors = issues.some((issue) => issue.severity === "error")
    return {
      valid: !hasErrors,
      modelCode: detail.modelCode,
      recordCount: 1,
      casillaCount: casillas.length,
      filename: buildAeatTxtFilename(detail, companyCif),
      issues,
    }
  }

  if (usesDr111Envelope(detail.modelCode)) {
    const period = model111FilePeriod(detail.quarter)
    const opening = period ? `<T1110${detail.year}${period}0000>` : ""
    const pageStart = content.indexOf("<T11101000>")
    const page = pageStart >= 0 ? content.slice(pageStart, pageStart + MODEL_111_PAGE_LENGTH) : ""
    if (!period || !content.startsWith(opening) || !content.includes("<AUX>") || !content.includes("</AUX>")) {
      issues.push({
        code: "DR111_ENVELOPE",
        message: "El fichero del modelo 111 no tiene la envolvente <T1110…> ni el bloque <AUX> del diseño DR111.",
        severity: "error",
      })
    }
    if (page.length !== MODEL_111_PAGE_LENGTH || !page.endsWith("</T11101000>")) {
      issues.push({
        code: "DR111_PAGE",
        message: `La página 01 del modelo 111 debe ocupar ${MODEL_111_PAGE_LENGTH} posiciones.`,
        severity: "error",
      })
    }
    if (period && !content.endsWith(`</T1110${detail.year}${period}0000>`)) {
      issues.push({
        code: "DR111_CLOSING",
        message: "Falta el cierre </T1110…> del fichero del modelo 111.",
        severity: "error",
      })
    }
    const hasErrors = issues.some((issue) => issue.severity === "error")
    return {
      valid: !hasErrors,
      modelCode: detail.modelCode,
      recordCount: 1,
      casillaCount: casillas.length,
      filename: buildAeatTxtFilename(detail, companyCif),
      issues,
    }
  }

  if (usesDr202Envelope(detail.modelCode)) {
    const period = model202FilePeriod(detail.quarter)
    const opening = period ? `<T2020${detail.year}${period}0000>` : ""
    const page1Start = content.indexOf("<T20201000>")
    const page2Start = content.indexOf("<T20202000>")
    const page1 = page1Start >= 0 ? content.slice(page1Start, page1Start + MODEL_202_PAGE1_LENGTH) : ""
    const page2 = page2Start >= 0 ? content.slice(page2Start, page2Start + MODEL_202_PAGE2_LENGTH) : ""
    if (!period || !content.startsWith(opening) || !content.includes("<AUX>") || !content.includes("</AUX>")) {
      issues.push({
        code: "DR202_ENVELOPE",
        message: "El fichero del modelo 202 no tiene la envolvente <T2020…> ni el bloque <AUX> del diseño DR202.",
        severity: "error",
      })
    }
    if (page1.length !== MODEL_202_PAGE1_LENGTH || !page1.endsWith("</T20201000>")) {
      issues.push({
        code: "DR202_PAGE1",
        message: `La página 01 del modelo 202 debe ocupar ${MODEL_202_PAGE1_LENGTH} posiciones.`,
        severity: "error",
      })
    }
    if (page2.length !== MODEL_202_PAGE2_LENGTH || !page2.endsWith("</T20202000>")) {
      issues.push({
        code: "DR202_PAGE2",
        message: `La página 02 del modelo 202 debe ocupar ${MODEL_202_PAGE2_LENGTH} posiciones.`,
        severity: "error",
      })
    }
    if (period && !content.endsWith(`</T2020${detail.year}${period}0000>`)) {
      issues.push({
        code: "DR202_CLOSING",
        message: "Falta el cierre </T2020…> del fichero del modelo 202.",
        severity: "error",
      })
    }
    if (model202Cnae(detail).length !== 4) {
      issues.push({
        code: "DR202_CNAE",
        message: "Indica el CNAE de cuatro cifras de la actividad principal. Sin él, la Sede rechaza el fichero.",
        severity: "error",
      })
    }
    const hasErrors = issues.some((issue) => issue.severity === "error")
    return {
      valid: !hasErrors,
      modelCode: detail.modelCode,
      recordCount: 1,
      casillaCount: casillas.length,
      filename: buildAeatTxtFilename(detail, companyCif),
      issues,
    }
  }

  if (usesDr303Envelope(detail.modelCode)) {
    const context = buildTaxEngine303Context(detail, companyName, companyCif, options)
    const taxCasillas = buildTaxEngine303Casillas(detail)
    const validation = buildModel303ValidationOnly({ context, casillas: taxCasillas })
    issues.push(
      ...validation.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        severity: issue.severity,
      })),
    )
    if (source?.submissionFormat === "boe-500") {
      issues.push({
        code: "SOURCE_FORMAT_UPDATED",
        message: "El modelo 303 usa diseño DR303 (envolvente <T3030…>) desde 2026, no BOE-500.",
        severity: "warning",
      })
    }
    const hasErrors = issues.some((issue) => issue.severity === "error")
    return {
      valid: !hasErrors,
      modelCode: detail.modelCode,
      recordCount: 1,
      casillaCount: casillas.length,
      filename: buildAeatTxtFilename(detail, companyCif),
      issues,
    }
  }

  issues.push(...validateLegacyRecordLines(content))
  if (source?.submissionFormat === "boe-500" && content.split(/\r?\n/).some((line) => line.length !== LEGACY_AEAT_RECORD_LENGTH)) {
    issues.push({
      code: "DESIGN_MISMATCH",
      message:
        "El fichero no cumple el diseño de registro BOE legacy de 500 posiciones. Pendiente adaptador oficial.",
      severity: "warning",
    })
  }

  const lines = content.split(/\r?\n/).filter(Boolean)
  const hasErrors = issues.some((issue) => issue.severity === "error")
  return {
    valid: !hasErrors,
    modelCode: detail.modelCode,
    recordCount: lines.length,
    casillaCount: casillas.length,
    filename: buildAeatTxtFilename(detail, companyCif),
    issues,
  }
}
