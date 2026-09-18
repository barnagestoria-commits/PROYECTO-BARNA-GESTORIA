import { canonicalAccountDigits } from "@/lib/accounting/canonical-account-code"
import type { LibrosRegistroActivity, LibrosRegistroActivityCodes } from "@/lib/fiscal/aeat/libros-registro/types"

const SERVICE_ACTIVITY_PATTERN =
  /profesional|asesor|consultor|repart|mensaj|paquete|artist|deport|722|757|849|721|933|973/i
const TRADE_ACTIVITY_PATTERN = /comercio|tienda|minorista|mayorista|empresarial|64[0-9]|65[0-9]|66[0-9]/i
const RENTAL_ACTIVITY_PATTERN = /arrend|alquiler|inmueble|861/i
const AGRICULTURE_PATTERN = /agricol|ganader|forestal|pesca|912|913|914/i

export const LIQUIDATION_COMMAND_CODES = new Set([
  "57",
  "111",
  "115",
  "123",
  "130",
  "180",
  "190",
  "303",
  "347",
  "349",
  "390",
])

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function accountDigits(cuenta: string): string {
  return canonicalAccountDigits(cuenta)
}

export function isIncomeAccount(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("7")
}

export function isExpenseAccount(cuenta: string): boolean {
  const digits = accountDigits(cuenta)
  return digits.startsWith("6")
}

export function isRepercutidoAccount(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("477")
}

export function isSoportadoAccount(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("472")
}

export function isIrpfSufferedAccount(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("473")
}

export function isIrpfPracticedAccount(cuenta: string): boolean {
  return accountDigits(cuenta).startsWith("4751")
}

export function resolveActivityCodes(activities: LibrosRegistroActivity[]): LibrosRegistroActivityCodes {
  const activity = activities.find((item) => item.isMain) ?? activities[0]
  const haystack = [activity?.epigraph, activity?.description, activity?.type].filter(Boolean).join(" ")
  const epigrafe = (activity?.epigraph ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4)

  if (AGRICULTURE_PATTERN.test(haystack)) {
    return { codigo: "B", tipo: "01", epigrafe }
  }
  if (RENTAL_ACTIVITY_PATTERN.test(haystack)) {
    return { codigo: "A", tipo: "01", epigrafe }
  }
  if (TRADE_ACTIVITY_PATTERN.test(haystack)) {
    return { codigo: "A", tipo: "03", epigrafe }
  }
  if (SERVICE_ACTIVITY_PATTERN.test(haystack) || !activity) {
    return { codigo: "A", tipo: "05", epigrafe }
  }
  return { codigo: "A", tipo: "03", epigrafe }
}

export function incomeConceptFromAccount(cuenta: string): string {
  const digits = accountDigits(cuenta)
  if (digits.startsWith("76")) return "I02"
  if (digits.startsWith("740") || digits.startsWith("746")) return "I03"
  if (digits.startsWith("747")) return "I04"
  if (digits.startsWith("75") || digits.startsWith("77") || digits.startsWith("78")) return "I07"
  return "I01"
}

export function expenseConceptFromAccount(cuenta: string): string {
  const digits = accountDigits(cuenta)
  if (digits.startsWith("60")) return "G01"
  if (digits.startsWith("61")) return "G03"
  if (digits.startsWith("640")) return "G04"
  if (digits.startsWith("641")) return "G07"
  if (digits.startsWith("642")) return "G05"
  if (digits.startsWith("643") || digits.startsWith("649")) return "G10"
  if (digits.startsWith("621")) return "G12"
  if (digits.startsWith("622")) return "G13"
  if (digits.startsWith("623")) return "G21"
  if (digits.startsWith("624")) return "G23"
  if (digits.startsWith("625")) return "G22"
  if (digits.startsWith("626")) return "G20"
  if (digits.startsWith("628")) return "GY4"
  if (digits.startsWith("629")) return "G23"
  if (digits.startsWith("631")) return "G19"
  if (digits.startsWith("66")) return "G24"
  if (digits.startsWith("681") || digits.startsWith("680") || digits.startsWith("682")) return "G38"
  return "G26"
}

export function vatKeyFromOperation(operation: string, book: "issued" | "received"): {
  claveOperacion: string
  calificacion: string
  operacionExenta: string
  inversionSujetoPasivo: string
} {
  if (operation === "3") {
    return book === "issued"
      ? { claveOperacion: "01", calificacion: "", operacionExenta: "E5", inversionSujetoPasivo: "N" }
      : { claveOperacion: "09", calificacion: "", operacionExenta: "", inversionSujetoPasivo: "N" }
  }
  if (operation === "4") {
    return book === "issued"
      ? { claveOperacion: "01", calificacion: "S2", operacionExenta: "", inversionSujetoPasivo: "S" }
      : { claveOperacion: "01", calificacion: "", operacionExenta: "", inversionSujetoPasivo: "S" }
  }
  if (operation === "5") {
    return { claveOperacion: "01", calificacion: "S1", operacionExenta: "", inversionSujetoPasivo: "N" }
  }
  return { claveOperacion: "01", calificacion: "S1", operacionExenta: "", inversionSujetoPasivo: "N" }
}
