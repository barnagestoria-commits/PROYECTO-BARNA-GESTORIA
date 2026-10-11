/**
 * Liquidación del modelo 130 según el diseño vigente (DR130, ejercicios 2019 y siguientes).
 * Casillas 01 a 19 del pago fraccionado en estimación directa.
 * La minoración de la casilla 13 es la del art. 110.3.c del Reglamento del IRPF.
 */

export interface Model130Options {
  activityStartDate: string | null
  /** Rendimiento neto (ingresos − gastos) del ejercicio anterior. Null si no hay libros. */
  priorYearNetFromBooks: number | null
}

export interface Model130Carry {
  previousPositive07: number
  pendingNegatives: number
}

export interface Model130Casillas {
  c01: number
  c02: number
  c03: number
  c04: number
  c05: number
  c06: number
  c07: number
  c08: number
  c09: number
  c10: number
  c11: number
  c12: number
  c13: number
  c14: number
  c15: number
  c16: number
  c17: number
  c18: number
  c19: number
  /** Cuota a ingresar. La casilla 19 puede quedar negativa para trimestres siguientes. */
  amount: number
  minoracionReason: string
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Escala del art. 110.3.c del RIRPF. Null si no hay dato del ejercicio anterior. */
export function minoracionArt110(priorYearNetIncome: number | null): number {
  if (priorYearNetIncome === null) return 0
  if (priorYearNetIncome <= 9000) return 100
  if (priorYearNetIncome <= 10000) return 75
  if (priorYearNetIncome <= 11000) return 50
  if (priorYearNetIncome <= 12000) return 25
  return 0
}

/**
 * Alta en el ejercicio de la declaración, o posterior: no hubo actividad el año anterior
 * y el rendimiento se considera 0 (minoración de 100 €).
 * Alta anterior: se usa el rendimiento de los libros del año previo.
 * Sin fecha de alta no se inventa la minoración.
 */
export function resolvePriorYearNetIncome(params: {
  declarationYear: number
  activityStartDate: string | null
  priorYearNetFromBooks: number | null
}): { net: number | null; reason: string } {
  const start = params.activityStartDate?.slice(0, 10) ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return {
      net: null,
      reason: "Sin fecha de alta no se aplica la minoración del art. 110.3.c.",
    }
  }

  const startYear = Number(start.slice(0, 4))
  if (startYear >= params.declarationYear) {
    return {
      net: 0,
      reason: `Alta en ${startYear}: sin actividad el año anterior, minoración de 100 € (art. 110.3.c).`,
    }
  }

  if (params.priorYearNetFromBooks === null) {
    return {
      net: null,
      reason: "Alta anterior a este ejercicio y sin contabilidad del año previo: no se aplica la minoración.",
    }
  }

  const minoracion = minoracionArt110(params.priorYearNetFromBooks)
  const formatted = params.priorYearNetFromBooks.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return {
    net: params.priorYearNetFromBooks,
    reason:
      minoracion > 0
        ? `Rendimiento neto del ejercicio anterior: ${formatted} €. Minoración art. 110.3.c: ${minoracion} €.`
        : `Rendimiento neto del ejercicio anterior: ${formatted} €. Supera 12.000 €, sin minoración.`,
  }
}

export function settleModel130Quarter(input: {
  ingresos: number
  gastos: number
  retenciones: number
  carry: Model130Carry
  priorYearNetIncome: number | null
  minoracionReason: string
}): { casillas: Model130Casillas; nextCarry: Model130Carry } {
  const c01 = round2(input.ingresos)
  const c02 = round2(input.gastos)
  const c03 = round2(c01 - c02)
  const c04 = c03 > 0 ? round2(c03 * 0.2) : 0
  const c05 = round2(Math.max(0, input.carry.previousPositive07))
  const c06 = round2(Math.max(0, input.retenciones))
  const c07 = round2(c04 - c05 - c06)
  const c08 = 0
  const c09 = 0
  const c10 = 0
  const c11 = 0
  const c12 = c07 + c11 > 0 ? round2(c07 + c11) : 0
  const c13 = minoracionArt110(input.priorYearNetIncome)
  const c14 = round2(c12 - c13)
  const c15 = c14 > 0 ? round2(Math.min(c14, Math.max(0, input.carry.pendingNegatives))) : 0
  const c16 = 0
  const c17 = round2(c14 - c15 - c16)
  const c18 = 0
  const c19 = round2(c17 - c18)

  const pendingAfterDeduction = round2(Math.max(0, input.carry.pendingNegatives) - c15)
  const pendingNegatives = c19 < 0 ? round2(pendingAfterDeduction + Math.abs(c19)) : pendingAfterDeduction

  return {
    casillas: {
      c01,
      c02,
      c03,
      c04,
      c05,
      c06,
      c07,
      c08,
      c09,
      c10,
      c11,
      c12,
      c13,
      c14,
      c15,
      c16,
      c17,
      c18,
      c19,
      amount: Math.max(0, c19),
      minoracionReason: input.minoracionReason,
    },
    nextCarry: {
      previousPositive07: round2(input.carry.previousPositive07 + Math.max(0, c07)),
      pendingNegatives,
    },
  }
}
