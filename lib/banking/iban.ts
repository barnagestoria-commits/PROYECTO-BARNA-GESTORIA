/** IBAN compacto en mayúsculas, sin espacios. Vacío si no hay dígitos ni letras. */
export function normalizeIban(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

export function formatIbanDisplay(value: string | null | undefined): string {
  const compact = normalizeIban(value)
  if (!compact) return ""
  return compact.replace(/(.{4})/g, "$1 ").trim()
}

export function isValidIban(value: string | null | undefined): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith("ES") && iban.length !== 24) return false
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  const numeric = rearranged.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55))
  let remainder = 0
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** undefined = no tocar el campo. null = borrarlo. */
export function parseOptionalIban(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  const compact = normalizeIban(value)
  if (!compact) return null
  if (!isValidIban(compact)) {
    throw new Error("El IBAN no es válido. Revísalo, incluido el código de país y los dígitos de control.")
  }
  return compact
}

export function parseOptionalBankName(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? ""
  if (!trimmed) return null
  if (trimmed.length > 70) {
    throw new Error("El nombre del banco no puede pasar de 70 caracteres.")
  }
  return trimmed
}
