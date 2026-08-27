import type { TaxReturnContext, TaxValidationIssue, TaxValidationResult } from "../../types"
import {
  MODEL_303_PAGE_01000_LENGTH,
  MODEL_303_PAGE_03000_LENGTH,
} from "./field-map"

function quarterToPeriod(period: string): string {
  if (/^\dT$/.test(period)) return period
  if (period === "annual" || period === "0A") return "0A"
  return period
}

export function validateModel303Export(content: string, context: TaxReturnContext): TaxValidationResult {
  const issues: TaxValidationIssue[] = []
  const period = quarterToPeriod(context.period)
  const opening = `<T3030${context.year}${period}0000>`
  const closing = `</T3030${context.year}${period}0000>`
  const normalizedNif = context.companyNif.replace(/[^A-Z0-9]/gi, "").toUpperCase()

  if (!/^[A-Z0-9]{9}$/.test(normalizedNif)) {
    issues.push({
      code: "INVALID_NIF",
      message: "El NIF del declarante debe contener exactamente 9 caracteres alfanuméricos.",
      severity: "error",
    })
  }

  if (!context.companyName.trim()) {
    issues.push({
      code: "MISSING_COMPANY_NAME",
      message: "Falta el nombre o razón social del declarante.",
      severity: "error",
    })
  }

  if (!/^[1-4]T$/.test(period)) {
    issues.push({
      code: "INVALID_PERIOD",
      message: "El modelo 303 trimestral requiere un periodo 1T, 2T, 3T o 4T.",
      severity: "error",
    })
  }

  if (!content.startsWith(opening)) {
    issues.push({
      code: "MISSING_ENVELOPE_OPEN",
      message: `El fichero debe comenzar con ${opening}.`,
      severity: "error",
    })
  }

  if (!content.endsWith(closing)) {
    issues.push({
      code: "MISSING_ENVELOPE_CLOSE",
      message: `El fichero debe terminar con ${closing}.`,
      severity: "error",
    })
  }

  if (!content.includes("<AUX>") || !content.includes("</AUX>")) {
    issues.push({
      code: "MISSING_AUX_BLOCK",
      message: "Falta el bloque <AUX> exigido por DR303e26v101.",
      severity: "error",
    })
  }

  const page01000Start = content.indexOf("<T30301000>")
  const page01000End = content.indexOf("</T30301000>")
  if (page01000Start === -1 || page01000End === -1) {
    issues.push({
      code: "MISSING_PAGE_01000",
      message: "Falta la página 01000 del modelo 303.",
      severity: "error",
    })
  } else {
    const pageLength = page01000End + "</T30301000>".length - page01000Start
    if (pageLength !== MODEL_303_PAGE_01000_LENGTH) {
      issues.push({
        code: "PAGE_01000_LENGTH",
        message: `La página 01000 mide ${pageLength} posiciones; se esperaban ${MODEL_303_PAGE_01000_LENGTH}.`,
        severity: "error",
      })
    }
  }

  const page03000Start = content.indexOf("<T30303000>")
  const page03000End = content.indexOf("</T30303000>")
  if (page03000Start === -1 || page03000End === -1) {
    issues.push({
      code: "MISSING_PAGE_03000",
      message: "Falta la página 03000 del modelo 303.",
      severity: "error",
    })
  } else {
    const pageLength = page03000End + "</T30303000>".length - page03000Start
    if (pageLength !== MODEL_303_PAGE_03000_LENGTH) {
      issues.push({
        code: "PAGE_03000_LENGTH",
        message: `La página 03000 mide ${pageLength} posiciones; se esperaban ${MODEL_303_PAGE_03000_LENGTH}.`,
        severity: "error",
      })
    }
  }

  if (content.includes("\n") || content.includes("\r")) {
    issues.push({
      code: "UNEXPECTED_NEWLINES",
      message: "El diseño DR303 no admite saltos de línea en el registro telemático.",
      severity: "error",
    })
  }

  if (content.includes("BARNA GESTORIA") || content.includes("GENERADO POR")) {
    issues.push({
      code: "BRANDING_FORBIDDEN",
      message: "El fichero telemático no puede incluir marcas comerciales.",
      severity: "error",
    })
  }

  const hasErrors = issues.some((issue) => issue.severity === "error")
  return {
    valid: !hasErrors,
    modelCode: "303",
    format: "dr303-envelope",
    issues,
  }
}
