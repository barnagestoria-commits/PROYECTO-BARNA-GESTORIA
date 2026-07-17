const TAX_ID_LABEL_PREFIX =
  /^(?:NIF|CIF|VAT|IVA|DNI|NIE|TIN|ID|N\.?\s*I\.?\s*F\.?|IDENTIFICADOR\s+FISCAL)\s*[:\-/]?\s*/i

/**
 * Normaliza un NIF/CIF/VAT para almacenamiento y validación.
 * Elimina etiquetas (NIF, CIF…), espacios, guiones, puntos y demás puntuación.
 *
 * Ej.: "NIF A-84919760." → "A84919760"
 */
export function normalizeTaxId(value: string): string {
  let cleaned = value.trim().toUpperCase()

  for (let i = 0; i < 3; i++) {
    const next = cleaned.replace(TAX_ID_LABEL_PREFIX, "")
    if (next === cleaned) break
    cleaned = next
  }

  cleaned = cleaned.replace(/[^A-Z0-9]/g, "")

  // OCR a veces pega la etiqueta al identificador: NIFA84919760
  cleaned = cleaned.replace(/^NIF(?=[A-Z0-9])/, "")
  cleaned = cleaned.replace(/^CIF(?=[A-Z0-9])/, "")
  cleaned = cleaned.replace(/^VAT(?=[A-Z0-9])/, "")

  return cleaned
}

/** Comprueba que el identificador tenga un formato mínimo plausible tras normalizar. */
export function isPlausibleTaxId(value: string): boolean {
  const normalized = normalizeTaxId(value)
  return normalized.length >= 8 && normalized.length <= 14 && /^[A-Z0-9]+$/.test(normalized)
}
