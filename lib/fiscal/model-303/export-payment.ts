import type { Model303FileOptions } from "@/lib/fiscal/aeat/tax-engine-bridge"
import { isValidIban } from "@/lib/banking/iban"

/** Forma de ingreso/devolución incluida en el fichero DR303. */
export type Model303ExportPayment = "ingreso" | "domiciliacion" | "compensacion"

const VALID: Model303ExportPayment[] = ["ingreso", "domiciliacion", "compensacion"]

export function parseModel303ExportPayment(value: string | null): Model303ExportPayment | null {
  if (!value) return null
  return VALID.includes(value as Model303ExportPayment) ? (value as Model303ExportPayment) : null
}

export function resolveModel303FileOptions(params: {
  payment: Model303ExportPayment | null
  resultAmount: number
  taxDirectDebitIban: string | null | undefined
}): { options: Model303FileOptions; error?: string } {
  const { payment, resultAmount, taxDirectDebitIban } = params
  const iban = (taxDirectDebitIban ?? "").replace(/\s/g, "").toUpperCase()

  if (resultAmount > 0.005) {
    const choice = payment ?? "ingreso"
    if (choice === "compensacion") {
      return { options: {}, error: "Con resultado a ingresar no puede elegirse compensación." }
    }
    if (choice === "domiciliacion") {
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
    if (choice === "domiciliacion" || choice === "ingreso") {
      return {
        options: {},
        error: "Con resultado negativo use compensación en autoliquidaciones posteriores.",
      }
    }
    return { options: {} }
  }

  return { options: {} }
}

export function defaultModel303ExportPayment(resultAmount: number): Model303ExportPayment {
  if (resultAmount > 0.005) return "ingreso"
  if (resultAmount < -0.005) return "compensacion"
  return "ingreso"
}
