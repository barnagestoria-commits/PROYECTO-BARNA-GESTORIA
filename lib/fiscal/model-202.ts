import { buildExtracontableReport, type ExtracontableAsset } from "@/lib/fixed-assets/extracontable"

/**
 * Modelo 202. Dos modalidades:
 * - Art. 40.2 LIS: el 18 % de la cuota neta del último impuesto ya vencido.
 *   El mismo importe se ingresa en abril, octubre y diciembre.
 * - Art. 40.3 LIS: sobre la base de los 3, 9 u 11 primeros meses.
 *   El porcentaje es 5/7 del tipo, por defecto (25 % → 17 %),
 *   o 19/20 por exceso si la cifra de negocios es de al menos 10 millones (25 % → 24 %).
 *   Se restan retenciones y pagos fraccionados anteriores.
 */

export type Model202Payment = "1P" | "2P" | "3P"
export type Model202Modality = "ART_40_2" | "ART_40_3"

export const MODEL_202_GENERAL_TAX_RATE = 25
export const MODEL_202_ARTICLE_402_PERCENT = 18

export interface Model202Options {
  modality: Model202Modality
  taxRate: number
  /** Casilla 01 del 40.2: cuota íntegra del último ejercicio, ya minorada. */
  priorNetQuota: number | null
  /** Cifra de negocios de los doce meses anteriores, al menos 10 millones. */
  turnoverAtLeast10m: boolean
  /** Casilla 07. Aumentos extracontables, salvo el impuesto sobre sociedades. */
  correctionsIncrease: number
  /** Casilla 08. Disminuciones extracontables. */
  correctionsDecrease: number
  /** Casilla 14. Bases imponibles negativas que se compensan. */
  negativeBases: number
  /** Amortización contable distinta de la fiscal. Casillas 07 y 08 del tramo del pago. */
  assets?: ExtracontableAsset[]
}

export const DEFAULT_MODEL_202_OPTIONS: Model202Options = {
  modality: "ART_40_2",
  taxRate: MODEL_202_GENERAL_TAX_RATE,
  priorNetQuota: null,
  turnoverAtLeast10m: false,
  correctionsIncrease: 0,
  correctionsDecrease: 0,
  negativeBases: 0,
}

export function model202InstallmentPercent(
  taxRate = MODEL_202_GENERAL_TAX_RATE,
  turnoverAtLeast10m = false,
): number {
  if (turnoverAtLeast10m) return Math.ceil((19 * taxRate) / 20)
  return Math.floor((5 * taxRate) / 7)
}

export function model202PaymentForQuarter(quarter: number): Model202Payment | null {
  if (quarter === 1) return "1P"
  if (quarter === 3) return "2P"
  if (quarter === 4) return "3P"
  return null
}

export function model202PeriodLabel(quarter: number | "annual", year: number): string {
  if (quarter === "annual") return `Pagos fraccionados ${year}`
  const payment = model202PaymentForQuarter(quarter)
  if (payment === "1P") return `1P ${year} · presentación en abril`
  if (payment === "2P") return `2P ${year} · presentación en octubre`
  if (payment === "3P") return `3P ${year} · presentación en diciembre`
  return `2T ${year} · sin pago fraccionado`
}

function cutoffMonth(payment: Model202Payment): number {
  if (payment === "1P") return 3
  if (payment === "2P") return 9
  return 11
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function asNumber(value: number | { toString(): string }): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface Model202SourceLine {
  id: string
  cuenta: string
  debe: number | { toString(): string }
  haber: number | { toString(): string }
  entry: { id: string; fecha: Date }
}

function accountDigits(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

export interface Model202Casillas {
  modality: Model202Modality
  c01: number
  c03: number
  c04: number
  c05: number
  c06: number
  c07: number
  c08: number
  c13: number
  c14: number
  c16: number
  c17: number
  c18: number
  c28: number
  c30: number
  c32: number
  c33: number
  c34: number
}

export interface Model202Settlement {
  payment: Model202Payment | null
  modality: Model202Modality
  casillas: Model202Casillas
  /** Base que explica el pago: casilla 01 en el 40.2 y casilla 16 en el 40.3. */
  base: number
  percent: number
  cumulativeQuota: number
  previousPayments: number
  amountDue: number
  lineCount: number
  entryIds: Set<string>
  priorQuotaMissing: boolean
}

function emptyCasillas(modality: Model202Modality, percent: number): Model202Casillas {
  return {
    modality,
    c01: 0,
    c03: 0,
    c04: 0,
    c05: 0,
    c06: 0,
    c07: 0,
    c08: 0,
    c13: 0,
    c14: 0,
    c16: 0,
    c17: percent,
    c18: 0,
    c28: 0,
    c30: 0,
    c32: 0,
    c33: 0,
    c34: 0,
  }
}

function emptySettlement(
  modality: Model202Modality,
  percent: number,
  priorQuotaMissing = false,
): Model202Settlement {
  return {
    payment: null,
    modality,
    casillas: emptyCasillas(modality, percent),
    base: 0,
    percent,
    cumulativeQuota: 0,
    previousPayments: 0,
    amountDue: 0,
    lineCount: 0,
    entryIds: new Set(),
    priorQuotaMissing,
  }
}

function inWindow(line: Model202SourceLine, year: number, throughMonth: number): boolean {
  const fecha = line.entry.fecha
  if (fecha.getUTCFullYear() !== year) return false
  const month = fecha.getUTCMonth() + 1
  return month >= 1 && month <= throughMonth
}

function periodFigures(
  lines: Model202SourceLine[],
  year: number,
  throughMonth: number,
): { resultAfterTax: number; taxIncrease: number; taxDecrease: number; withholdings: number; lineCount: number; entryIds: Set<string> } {
  const entryIds = new Set<string>()
  let resultAfterTax = 0
  let taxDebit = 0
  let taxCredit = 0
  let withholdings = 0
  let lineCount = 0

  for (const line of lines) {
    if (!inWindow(line, year, throughMonth)) continue
    const digits = accountDigits(line.cuenta)
    if (!digits) continue
    const debe = asNumber(line.debe)
    const haber = asNumber(line.haber)
    if (digits.startsWith("6") || digits.startsWith("7")) {
      resultAfterTax += haber - debe
      lineCount += 1
      entryIds.add(line.entry.id)
    }
    if (digits.startsWith("630")) {
      taxDebit += debe
      taxCredit += haber
    }
    if (digits.startsWith("473")) {
      withholdings += debe - haber
      lineCount += 1
      entryIds.add(line.entry.id)
    }
  }

  return {
    resultAfterTax: round2(resultAfterTax),
    taxIncrease: round2(Math.max(0, taxDebit - taxCredit)),
    taxDecrease: round2(Math.max(0, taxCredit - taxDebit)),
    withholdings: round2(Math.max(0, withholdings)),
    lineCount,
    entryIds,
  }
}

function compensateNegativeBases(basePrevia: number, requested: number): number {
  if (basePrevia <= 0 || requested <= 0) return 0
  const limit = Math.max(1_000_000, round2(basePrevia * 0.7))
  return round2(Math.min(requested, basePrevia, limit))
}

function previousPaymentsDue(
  lines: Model202SourceLine[],
  year: number,
  payment: Model202Payment,
  options: Model202Options,
): number {
  if (payment === "1P") return 0
  const first = settleModel202(lines, year, 1, options).amountDue
  if (payment === "2P") return first
  return round2(first + settleModel202(lines, year, 3, options).amountDue)
}

export function settleModel202(
  lines: Model202SourceLine[],
  year: number,
  quarter: 1 | 2 | 3 | 4 | "annual",
  options: Model202Options = DEFAULT_MODEL_202_OPTIONS,
): Model202Settlement {
  const modality = options.modality
  const percent =
    modality === "ART_40_2"
      ? MODEL_202_ARTICLE_402_PERCENT
      : model202InstallmentPercent(options.taxRate, options.turnoverAtLeast10m)

  if (quarter === "annual") {
    const third = settleModel202(lines, year, 4, options)
    const due = round2(
      settleModel202(lines, year, 1, options).amountDue +
        settleModel202(lines, year, 3, options).amountDue +
        third.amountDue,
    )
    return { ...third, payment: null, amountDue: due, casillas: { ...third.casillas, c34: due, c03: due } }
  }

  const payment = model202PaymentForQuarter(quarter)
  if (!payment) return emptySettlement(modality, percent)

  if (modality === "ART_40_2") {
    const prior = options.priorNetQuota
    if (prior === null) {
      return { ...emptySettlement(modality, percent, true), payment, lineCount: 1 }
    }
    const base = round2(Math.max(0, prior))
    const due = round2((base * percent) / 100)
    const casillas = emptyCasillas(modality, percent)
    casillas.c01 = base
    casillas.c03 = due
    casillas.c34 = due
    return {
      payment,
      modality,
      casillas,
      base,
      percent,
      cumulativeQuota: due,
      previousPayments: 0,
      amountDue: due,
      lineCount: prior > 0 ? 1 : 0,
      entryIds: new Set(),
      priorQuotaMissing: false,
    }
  }

  const figures = periodFigures(lines, year, cutoffMonth(payment))
  const c04 = figures.resultAfterTax
  const c05 = figures.taxIncrease
  const c06 = figures.taxDecrease
  const assetAdjustments = buildExtracontableReport(
    options.assets ?? [],
    year,
    options.taxRate,
    cutoffMonth(payment),
  )
  const c07 = round2(Math.max(0, options.correctionsIncrease) + assetAdjustments.increase)
  const c08 = round2(Math.max(0, options.correctionsDecrease) + assetAdjustments.decrease)
  const c13 = round2(c04 + c05 + c07 - c06 - c08)
  const c14 = compensateNegativeBases(c13, options.negativeBases)
  const c16 = round2(Math.max(0, c13 - c14))
  const c18 = c16 > 0 ? round2((c16 * percent) / 100) : 0
  const c28 = figures.withholdings
  const c30 = previousPaymentsDue(lines, year, payment, options)
  const c32 = round2(c18 - c28 - c30)
  const c33 =
    options.turnoverAtLeast10m && c04 > 0 ? round2(c04 * 0.23 - c30) : 0
  const c34 = round2(Math.max(0, c32, c33))
  const casillas: Model202Casillas = {
    modality,
    c01: 0,
    c03: 0,
    c04,
    c05,
    c06,
    c07,
    c08,
    c13,
    c14,
    c16,
    c17: percent,
    c18,
    c28,
    c30,
    c32,
    c33,
    c34,
  }

  return {
    payment,
    modality,
    casillas,
    base: c16,
    percent,
    cumulativeQuota: c18,
    previousPayments: c30,
    amountDue: c34,
    lineCount: figures.lineCount,
    entryIds: figures.entryIds,
    priorQuotaMissing: false,
  }
}
