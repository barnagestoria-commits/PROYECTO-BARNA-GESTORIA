import type { TaxReturnContext, TaxValidationIssue, TaxValidationResult } from "../../types"
import { isValidSpanishTaxId } from "../../amount-format"
import {
  MODEL_303_PAGE_01000_LENGTH,
  MODEL_303_PAGE_03000_LENGTH,
} from "./field-map"

function quarterToPeriod(period: string): string {
  if (/^\dT$/.test(period)) return period
  if (period === "annual" || period === "0A") return "0A"
  return period
}

function readAt(record: string, position: number, length: number): string {
  return record.slice(position - 1, position - 1 + length)
}

function parseAeatAmount(value: string): number {
  const negative = value.startsWith("N")
  const digits = negative ? value.slice(1) : value.trimStart()
  if (!/^\d+$/.test(digits)) return 0
  return (Number(digits) / 100) * (negative ? -1 : 1)
}

function amountsEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005
}

function isValidDdMmYyyy(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false
  const day = Number(value.slice(0, 2))
  const month = Number(value.slice(2, 4))
  const year = Number(value.slice(4, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function addFieldIssue(
  issues: TaxValidationIssue[],
  code: string,
  position: number,
  expected: string,
  actual: string,
): void {
  issues.push({
    code,
    message: `Posición ${position}: valor ${JSON.stringify(actual)}, se esperaba ${expected}.`,
    severity: "error",
  })
}

export function validateModel303Export(content: string, context: TaxReturnContext): TaxValidationResult {
  const issues: TaxValidationIssue[] = []
  const period = quarterToPeriod(context.period)
  const opening = `<T3030${context.year}${period}0000>`
  const closing = `</T3030${context.year}${period}0000>`
  const normalizedNif = context.companyNif.replace(/[^A-Z0-9]/gi, "").toUpperCase()

  if (!isValidSpanishTaxId(normalizedNif)) {
    issues.push({
      code: "INVALID_NIF",
      message: "El NIF del declarante no supera la validación de formato y dígito de control.",
      severity: "error",
    })
  }

  if (!context.software) {
    issues.push({
      code: "MISSING_SOFTWARE_IDENTITY",
      message: "Faltan la versión y el NIF legal de la entidad desarrolladora exigidos por la Nota 1.",
      severity: "error",
    })
  } else {
    if (!/^[A-Z0-9]{4}$/i.test(context.software.version)) {
      issues.push({
        code: "INVALID_SOFTWARE_VERSION",
        message: "La versión del software debe ocupar cuatro posiciones alfanuméricas.",
        severity: "error",
      })
    }
    if (!isValidSpanishTaxId(context.software.developerNif)) {
      issues.push({
        code: "INVALID_DEVELOPER_NIF",
        message: "El NIF de la entidad desarrolladora no supera la validación del dígito de control.",
        severity: "error",
      })
    }
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

    const page = content.slice(page01000Start, page01000End + "</T30301000>".length)
    const options = context.model303 ?? {}
    const periodIsLast = period === "4T"
    const checks: Array<[number, number, string, string]> = [
      [109, 1, options.exclusivelyForal ? "1" : "2", "1 o 2 según tributación foral"],
      [110, 1, options.registeredMonthlyRefund ? "1" : "2", "1 o 2 según REDEME"],
      [111, 1, "3", "3 (solo régimen general)"],
      [112, 1, options.jointReturn ? "1" : "2", "1 o 2 según autoliquidación conjunta"],
      [113, 1, options.cashBasisSubject ? "1" : "2", "1 o 2 según criterio de caja"],
      [114, 1, options.cashBasisRecipient ? "1" : "2", "1 o 2 según criterio de caja"],
      [115, 1, options.specialProrataOption ? "1" : "2", "1 o 2 según prorrata especial"],
      [116, 1, options.specialProrataRevocation ? "1" : "2", "1 o 2 según revocación"],
      [117, 1, options.bankruptcy ? "1" : "2", "1 o 2 según concurso"],
      [127, 1, options.voluntarySii ? "1" : "2", "1 o 2 según SII voluntario"],
      [130, 1, "0", "0 para periodos trimestrales"],
    ]

    for (const [position, length, expected, description] of checks) {
      const actual = readAt(page, position, length)
      if (actual !== expected) {
        addFieldIssue(issues, `FIELD_${position}`, position, description, actual)
      }
    }

    const bankruptcyDate = readAt(page, 118, 8)
    const bankruptcyType = readAt(page, 126, 1)
    if (options.bankruptcy) {
      if (!isValidDdMmYyyy(bankruptcyDate) || bankruptcyDate !== options.bankruptcy.orderDate) {
        addFieldIssue(issues, "INVALID_BANKRUPTCY_DATE", 118, "fecha DDMMYYYY", bankruptcyDate)
      }
      const expectedType = options.bankruptcy.type === "PRE" ? "1" : "2"
      if (bankruptcyType !== expectedType) {
        addFieldIssue(issues, "INVALID_BANKRUPTCY_TYPE", 126, expectedType, bankruptcyType)
      }
    } else {
      if (bankruptcyDate !== "        ") {
        addFieldIssue(issues, "UNEXPECTED_BANKRUPTCY_DATE", 118, "ocho blancos", bankruptcyDate)
      }
      if (bankruptcyType !== " ") {
        addFieldIssue(issues, "UNEXPECTED_BANKRUPTCY_TYPE", 126, "blanco", bankruptcyType)
      }
    }

    for (const [position, option, label] of [
      [128, options.annualSummaryExempt, "exoneración del modelo 390"],
      [129, options.annualOperationsNonZero, "volumen anual de operaciones"],
    ] as const) {
      const actual = readAt(page, position, 1)
      if (!periodIsLast && actual !== "0") {
        addFieldIssue(issues, `FIELD_${position}`, position, "0 fuera de 4T", actual)
      }
      if (periodIsLast && option === undefined) {
        issues.push({
          code: `MISSING_FIELD_${position}`,
          message: `En 4T debe indicarse expresamente ${label}.`,
          severity: "error",
        })
      } else if (periodIsLast) {
        const expected = option ? "1" : "2"
        if (actual !== expected) addFieldIssue(issues, `FIELD_${position}`, position, expected, actual)
      }
    }

    if (options.specialProrataOption && options.specialProrataRevocation) {
      issues.push({
        code: "INCOMPATIBLE_PRORATA_FLAGS",
        message: "No pueden marcarse simultáneamente opción y revocación de prorrata especial.",
        severity: "error",
      })
    }

    if (
      options.exclusivelyForal ||
      options.registeredMonthlyRefund ||
      options.jointReturn ||
      options.cashBasisSubject ||
      options.cashBasisRecipient ||
      options.specialProrataOption ||
      options.specialProrataRevocation ||
      options.bankruptcy ||
      options.voluntarySii
    ) {
      issues.push({
        code: "UNSUPPORTED_303_SCENARIO",
        message: "Este adaptador solo está certificado para régimen general trimestral sin supuestos especiales.",
        severity: "error",
      })
    }

    const cuota27 = parseAeatAmount(readAt(page, 696, 17))
    const expected27 = [153, 192, 231, 270, 309, 348, 382, 416, 450, 489, 528, 567, 606, 645, 679]
      .reduce((sum, position) => sum + parseAeatAmount(readAt(page, position, 17)), 0)
    const cuota45 = parseAeatAmount(readAt(page, 1002, 17))
    const expected45 = [730, 764, 798, 832, 866, 900, 934, 951, 968, 985]
      .reduce((sum, position) => sum + parseAeatAmount(readAt(page, position, 17)), 0)
    const cuota46 = parseAeatAmount(readAt(page, 1019, 17))

    if (!amountsEqual(cuota27, expected27)) {
      issues.push({ code: "ARITHMETIC_27", message: "La casilla 27 no coincide con la suma oficial de cuotas devengadas.", severity: "error" })
    }
    if (!amountsEqual(cuota45, expected45)) {
      issues.push({ code: "ARITHMETIC_45", message: "La casilla 45 no coincide con la suma oficial de cuotas deducibles.", severity: "error" })
    }
    if (!amountsEqual(cuota46, cuota27 - cuota45)) {
      issues.push({ code: "ARITHMETIC_46", message: "La casilla 46 no coincide con 27 − 45.", severity: "error" })
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

    const page = content.slice(page03000Start, page03000End + "</T30303000>".length)
    const page01000 = content.slice(page01000Start, page01000End + "</T30301000>".length)
    const result71 = parseAeatAmount(readAt(page, 408, 17))
    const declarationType = readAt(page01000, 13, 1)
    const allowedTypes =
      result71 > 0 ? ["I", "G", "U"] : result71 < 0 ? ["C", "D", "V", "X"] : ["N"]
    if (!allowedTypes.includes(declarationType)) {
      addFieldIssue(
        issues,
        "INVALID_DECLARATION_TYPE",
        13,
        allowedTypes.join(", "),
        declarationType,
      )
    }

    const result64 = parseAeatAmount(readAt(page, 199, 17))
    const result46 = parseAeatAmount(readAt(page01000, 1019, 17))
    const percent65 = Number(readAt(page, 216, 5)) / 100
    const result66 = parseAeatAmount(readAt(page, 221, 17))
    const import77 = parseAeatAmount(readAt(page, 238, 17))
    const applied78 = parseAeatAmount(readAt(page, 272, 17))
    const result68 = parseAeatAmount(readAt(page, 306, 17))
    const adjustment108 = parseAeatAmount(readAt(page, 323, 17))
    const result69 = parseAeatAmount(readAt(page, 340, 17))
    const previous70 = parseAeatAmount(readAt(page, 357, 17))
    const refunds109 = parseAeatAmount(readAt(page, 374, 17))
    const fuel112 = parseAeatAmount(readAt(page, 391, 17))
    const activityPositions = [209, 231, 248, 270, 287, 309, 326, 348, 365, 382, 399, 416, 433, 450, 467, 489, 506, 528, 545, 567, 584, 606, 623, 645, 662, 679, 713, 730, 747, 764, 781, 798, 815, 832, 849, 866, 883, 900]
    const hasActivity = activityPositions.some(
      (position) => !amountsEqual(parseAeatAmount(readAt(page01000, position, 17)), 0),
    )
    const noActivity = readAt(page, 425, 1)

    if (!amountsEqual(result64, result46)) {
      issues.push({ code: "ARITHMETIC_64", message: "La casilla 64 debe trasladar exactamente la casilla 46.", severity: "error" })
    }
    if (!amountsEqual(percent65, 100)) {
      issues.push({ code: "INVALID_PERCENT_65", message: "La casilla 65 debe ser 100,00 para tributación estatal ordinaria.", severity: "error" })
    }
    if (!amountsEqual(result66, result64 * (percent65 / 100))) {
      issues.push({ code: "ARITHMETIC_66", message: "La casilla 66 no coincide con 64 × 65%.", severity: "error" })
    }
    if (!amountsEqual(result69, result66 + import77 - applied78 + result68 + adjustment108)) {
      issues.push({ code: "ARITHMETIC_69", message: "La casilla 69 no cumple la fórmula oficial.", severity: "error" })
    }
    if (!amountsEqual(result71, result69 - previous70 + refunds109 - fuel112)) {
      issues.push({ code: "ARITHMETIC_71", message: "La casilla 71 no cumple la fórmula oficial.", severity: "error" })
    }
    if (noActivity !== (hasActivity ? " " : "X")) {
      addFieldIssue(
        issues,
        "INVALID_NO_ACTIVITY_MARK",
        425,
        hasActivity ? "blanco cuando existe actividad" : "X cuando no existe actividad",
        noActivity,
      )
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
