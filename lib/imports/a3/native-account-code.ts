/** Decodificación y reglas del Plan General Contable (PGC) para el export nativo A3. */

/** Grupos PGC reconocibles en campos binarios de 9 dígitos (posiciones 4-6). */
const PGC_MIDDLE: Record<string, string> = {
  "400": "400",
  "410": "410",
  "430": "430",
  "465": "465",
  "472": "472",
  "473": "473",
  "477": "477",
  "505": "505",
  "572": "572",
  "607": "607",
  "629": "629",
  "640": "640",
  "700": "700",
  "705": "705",
  "849": "849",
}

/** Grupos inexistentes o basura frecuente en exports binarios (p.ej. 800). */
const INVALID_PGC_GROUPS = new Set(["800", "801", "802", "900"])

export function padAccountCode12(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 12) return digits.slice(0, 12)
  return digits.padEnd(12, "0")
}

export function pgcGroup3(code: string): string {
  return padAccountCode12(code).slice(0, 3)
}

/** Rechaza grupos PGC inválidos (p.ej. 800, que no existe en el plan). */
export function isValidPgcAccountCode(code: string): boolean {
  const group = pgcGroup3(code)
  if (INVALID_PGC_GROUPS.has(group)) return false
  if (group.startsWith("8")) return false
  return group.length === 3 && /^\d{3}$/.test(group)
}

/**
 * Proveedores/acreedores: grupo 400 (proveedores), 410 (acreedores servicios)
 * o subplan extendido A3 4100XXXX.
 */
export function isProviderAccountCode(code: string): boolean {
  const digits = padAccountCode12(code)
  if (!isValidPgcAccountCode(digits) || isGenericProviderCode(digits)) return false

  if (/^4100[0-9]{4}/.test(digits) && digits !== "410000000000") return true
  if (/^400[0-9]/.test(digits)) return true
  if (/^410[0-9]/.test(digits)) return true
  return false
}

export function isClientAccountCode(code: string): boolean {
  const digits = padAccountCode12(code)
  return isValidPgcAccountCode(digits) && digits.startsWith("430")
}

/** Cuenta de proveedor resuelta del export (400/410/4100), no genérica. */
export function isResolvedProviderAccountCode(code: string): boolean {
  return isProviderAccountCode(code)
}

/** @deprecated Usar isResolvedProviderAccountCode */
export function isA3ProviderAccountCode(code: string): boolean {
  return isResolvedProviderAccountCode(code)
}

/** Cuenta de proveedor A3 nativa CU.DAT: subcuenta N → 4100NNNN0000. */
export function formatA3ProviderAccount(subaccount: number): string {
  if (!Number.isFinite(subaccount) || subaccount <= 0 || subaccount > 9999) {
    return "410000000000"
  }
  return padAccountCode12(`4100${String(subaccount).padStart(4, "0")}`)
}

/** u16 de referencia interna que en realidad es padding ASCII (p.ej. 0x2020). */
export function isGarbagePlanRef(value: number): boolean {
  if (value <= 0 || value > 9999) return true
  const lo = value & 0xff
  const hi = (value >> 8) & 0xff
  return lo === hi && lo >= 0x20 && lo <= 0x7e
}

/**
 * Campo de 9 dígitos con grupo PGC embebido: p.ej. 100400100 → 400000000100.
 * Las cuentas 4100XXXX de proveedor se leen preferentemente desde CU.DAT (u168/u156).
 */
export function decodeNativeNineDigitAccountField(field: string): string | null {
  const digits = field.replace(/\D/g, "")
  if (digits.length !== 9) return null
  if (digits === "400000000") return "400000000000"

  const middle = digits.slice(3, 6)
  if (INVALID_PGC_GROUPS.has(middle) || middle.startsWith("8")) return null

  const prefix = PGC_MIDDLE[middle]
  if (!prefix) return null

  const head = digits.slice(0, 3)
  const tail = digits.slice(6, 9)
  const sub = tail === "000" ? Number.parseInt(head, 10) : Number.parseInt(tail, 10)
  if (!Number.isFinite(sub)) return null

  const accountCode = prefix + String(sub).padStart(9, "0")
  return isValidPgcAccountCode(accountCode) ? accountCode : null
}

export function decodeSnnsAccountField(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 15 || !digits.startsWith("004")) return null
  const accountCode = "400" + digits.slice(3, 12)
  return isValidPgcAccountCode(accountCode) ? accountCode : null
}

/** Cuenta 400 sin subcuenta asignada (proveedor no resuelto). */
export function isGenericProviderCode(code: string): boolean {
  return code.replace(/\D/g, "") === "400000000000"
}

export const NINE_DIGIT_PGC_MIDDLE = new Set(Object.keys(PGC_MIDDLE))
