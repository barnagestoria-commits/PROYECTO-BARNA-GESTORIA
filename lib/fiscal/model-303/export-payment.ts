import type { Model303FileOptions } from "@/lib/fiscal/aeat/tax-engine-bridge"
import { isValidIban } from "@/lib/banking/iban"

/**
 * Forma de pago del asistente, alineada con A3.
 * Salvo la domiciliación, el DR303 se genera a ingresar (tipo I): el NRC y el
 * aplazamiento se indican en la Sede, porque el diseño de registro no los guarda.
 */
export type Model303ExportPayment =
  | "solicitud_nrc"
  | "nrc_obtenido"
  | "domiciliacion"
  | "entidad_colaboradora"
  | "aplazamiento"
  | "compensacion"

const VALID: Model303ExportPayment[] = [
  "solicitud_nrc",
  "nrc_obtenido",
  "domiciliacion",
  "entidad_colaboradora",
  "aplazamiento",
  "compensacion",
]

const TO_PAY_WITHOUT_DIRECT_DEBIT = new Set<Model303ExportPayment>([
  "solicitud_nrc",
  "nrc_obtenido",
  "entidad_colaboradora",
  "aplazamiento",
])

export interface Model303FilingPeriod {
  year: number
  quarter: number | "annual"
  now?: Date
}

function madridCalendar(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: read("year"), month: read("month"), day: read("day") }
}

function parseQuarter(quarter: number | "annual"): number | null {
  if (quarter === "annual") return null
  const value = typeof quarter === "number" ? quarter : Number(quarter)
  return value >= 1 && value <= 4 ? value : null
}

/** Último día de domiciliación del 303 (15 de abril, julio y octubre; 25 de enero en el 4T). */
export function model303DirectDebitDeadline(
  year: number,
  quarter: number | "annual",
): { year: number; month: number; day: number } | null {
  const period = parseQuarter(quarter)
  if (period === 1) return { year, month: 4, day: 15 }
  if (period === 2) return { year, month: 7, day: 15 }
  if (period === 3) return { year, month: 10, day: 15 }
  if (period === 4) return { year: year + 1, month: 1, day: 25 }
  return null
}

export function formatModel303DirectDebitDeadline(year: number, quarter: number | "annual"): string | null {
  const deadline = model303DirectDebitDeadline(year, quarter)
  if (!deadline) return null
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(Date.UTC(deadline.year, deadline.month - 1, deadline.day, 12)))
}

/** La domiciliación solo puede pedirse hasta el día 15 del mes de presentación (25 de enero en el 4T). */
export function isModel303DirectDebitOpen(period: Model303FilingPeriod): boolean {
  const deadline = model303DirectDebitDeadline(period.year, period.quarter)
  if (!deadline) return false
  const today = madridCalendar(period.now ?? new Date())
  const todayKey = today.year * 10000 + today.month * 100 + today.day
  const startKey = deadline.year * 10000 + deadline.month * 100 + 1
  const endKey = deadline.year * 10000 + deadline.month * 100 + deadline.day
  return todayKey >= startKey && todayKey <= endKey
}

export function parseModel303ExportPayment(value: string | null): Model303ExportPayment | null {
  if (!value) return null
  if (value === "nrc" || value === "ingreso") {
    return value === "nrc" ? "solicitud_nrc" : "entidad_colaboradora"
  }
  return VALID.includes(value as Model303ExportPayment) ? (value as Model303ExportPayment) : null
}

export function normalizeNrc(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

export function isValidNrc(value: string): boolean {
  return /^[A-Z0-9]{22}$/.test(normalizeNrc(value))
}

export function resolveModel303FileOptions(params: {
  payment: Model303ExportPayment | null
  resultAmount: number
  taxDirectDebitIban: string | null | undefined
  period?: Model303FilingPeriod
}): { options: Model303FileOptions; error?: string } {
  const { payment, resultAmount, taxDirectDebitIban, period } = params
  const iban = (taxDirectDebitIban ?? "").replace(/\s/g, "").toUpperCase()

  if (resultAmount > 0.005) {
    const choice = payment ?? defaultModel303ExportPayment(resultAmount, period)
    if (choice === "compensacion") {
      return { options: {}, error: "Con resultado a ingresar no puede elegirse compensación." }
    }
    if (TO_PAY_WITHOUT_DIRECT_DEBIT.has(choice)) {
      return { options: {} }
    }
    if (choice === "domiciliacion") {
      if (period && !isModel303DirectDebitOpen(period)) {
        const deadline = formatModel303DirectDebitDeadline(period.year, period.quarter)
        return {
          options: {},
          error: deadline
            ? `El plazo de domiciliación de este periodo terminó el ${deadline}. Elige solicitud de NRC.`
            : "El plazo de domiciliación de este periodo ya ha terminado. Elige solicitud de NRC.",
        }
      }
      if (!iban) {
        return {
          options: {},
          error:
            "Para domiciliar el ingreso indique la cuenta de impuestos en Configuración → Perfil de empresa.",
        }
      }
      if (!isValidIban(iban)) {
        return { options: {}, error: "El IBAN de domiciliación de impuestos no es válido." }
      }
      return { options: { taxDirectDebitIban: iban } }
    }
    return { options: {} }
  }

  if (resultAmount < -0.005) {
    const choice = payment ?? "compensacion"
    if (choice !== "compensacion") {
      return {
        options: {},
        error: "Con resultado negativo use compensación en autoliquidaciones posteriores.",
      }
    }
    return { options: {} }
  }

  return { options: {} }
}

export function defaultModel303ExportPayment(
  resultAmount: number,
  period?: Model303FilingPeriod,
  hasIban = false,
): Model303ExportPayment {
  if (resultAmount > 0.005) {
    const directDebitOpen = period ? isModel303DirectDebitOpen(period) : false
    if (directDebitOpen && hasIban) return "domiciliacion"
    return "solicitud_nrc"
  }
  if (resultAmount < -0.005) return "compensacion"
  return "solicitud_nrc"
}
