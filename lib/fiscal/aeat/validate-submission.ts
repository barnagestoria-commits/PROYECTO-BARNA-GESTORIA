import {
  AEAT_RECORD_LENGTH,
  buildAeatTxtFilename,
  generateAeatTxt,
  shouldOfferAeatTxt,
} from "@/lib/fiscal/aeat/generate-aeat-txt"
import { getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

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

function validateRecordLines(content: string): AeatSubmissionValidationIssue[] {
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
    if (line.length !== AEAT_RECORD_LENGTH) {
      issues.push({
        code: "RECORD_LENGTH",
        message: `Registro ${index + 1}: longitud ${line.length}, se esperaban ${AEAT_RECORD_LENGTH} posiciones BOE.`,
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

  const amountRecords = lines.filter((line) => line.startsWith("2"))
  if (amountRecords.length === 0) {
    issues.push({
      code: "NO_CASILLAS",
      message: "No hay registros de casilla (tipo 2) en el fichero BOE.",
      severity: "warning",
    })
  }

  return issues
}

/**
 * Valida el borrador telemático conforme al diseño de registro BOE (500 posiciones).
 * La presentación real en la sede exige certificado; aquí solo comprobamos integridad del fichero.
 */
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
  const lines = content.split(/\r?\n/).filter(Boolean)

  issues.push(...validateRecordLines(content))

  if (source?.submissionFormat === "boe-500" && lines.some((line) => line.length !== AEAT_RECORD_LENGTH)) {
    issues.push({
      code: "DESIGN_MISMATCH",
      message:
        "El fichero no cumple el diseño de registro BOE de 500 posiciones publicado en la sede AEAT.",
      severity: "error",
    })
  }

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
