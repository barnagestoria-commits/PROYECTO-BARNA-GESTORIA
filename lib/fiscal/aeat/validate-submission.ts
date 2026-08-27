import {
  buildAeatTxtFilename,
  generateAeatTxt,
  shouldOfferAeatTxt,
  usesDr303Envelope,
} from "@/lib/fiscal/aeat/generate-aeat-txt"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import {
  buildTaxEngine303Casillas,
  buildTaxEngine303Context,
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
  const buffer = generateAeatTxt(detail, companyName, companyCif)
  const content = buffer.toString("latin1")

  if (usesDr303Envelope(detail.modelCode)) {
    const context = buildTaxEngine303Context(detail, companyName, companyCif)
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
