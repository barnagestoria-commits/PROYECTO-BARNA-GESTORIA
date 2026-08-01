/** Decodificación de campos de cuenta binarios del export nativo A3 (CU.DAT). */

const PGC_MIDDLE: Record<string, string> = {
  "400": "400",
  "430": "430",
  "629": "629",
  "472": "472",
  "572": "572",
  "640": "640",
  "465": "465",
  "555": "555",
  "849": "849",
  "505": "505",
}

export function padAccountCode12(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 12) return digits.slice(0, 12)
  return digits.padEnd(12, "0")
}

/**
 * Campo de 9 dígitos con grupo PGC embebido: p.ej. 100400100 → 400000000100,
 * 300400000 → 400000000300 (FULLEXPO).
 */
export function decodeNativeNineDigitAccountField(field: string): string | null {
  const digits = field.replace(/\D/g, "")
  if (digits.length !== 9) return null

  const middle = digits.slice(3, 6)
  const prefix = PGC_MIDDLE[middle]
  if (!prefix) return null

  const head = digits.slice(0, 3)
  const tail = digits.slice(6, 9)
  const sub = tail === "000" ? Number.parseInt(head, 10) : Number.parseInt(tail, 10)
  if (!Number.isFinite(sub)) return null

  return prefix + String(sub).padStart(9, "0")
}

export function decodeSnnsAccountField(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 15 || !digits.startsWith("004")) return null
  return "400" + digits.slice(3, 12)
}

export function isGenericProviderCode(code: string): boolean {
  const digits = code.replace(/\D/g, "")
  return digits === "400000000000" || digits.endsWith("0000000000")
}
