/**
 * Datos del titular que aparecen en los textos legales.
 * Completa NIF y domicilio antes del lanzamiento comercial (LSSI-CE art. 10 y RGPD art. 13).
 * Mientras valgan `null`, las páginas legales muestran un aviso visible de dato pendiente.
 */
export const COMPANY_INFO = {
  brand: "Taxlyn",
  website: "taxlyn.com",
  // Supuesto: coincide con la beneficiaria de la cuenta bancaria. Confirmar.
  holderName: "Sonia Macías Tumbaco",
  taxId: null as string | null,
  address: null as string | null,
  contactEmail: "infotaxlyn@gmail.com",
  jurisdiction: "los juzgados y tribunales del domicilio del consumidor o, en su defecto, los de la ciudad de Barcelona",
}

export const PENDING_LABEL = "[dato pendiente de completar]"

export function companyField(value: string | null): string {
  return value && value.trim() ? value : PENDING_LABEL
}
