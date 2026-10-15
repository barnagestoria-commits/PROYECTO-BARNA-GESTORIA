import type { TaxReturnContext } from "../../types"

export function resolveModel303DeclarationType(
  cuota71: number,
  explicit?: TaxReturnContext["declarationType"],
  directDebit?: boolean,
): string {
  if (explicit) return explicit
  if (cuota71 > 0) return directDebit ? "U" : "I"
  if (cuota71 < 0) return "C"
  return "N"
}

/** Tipos de declaración a devolver (marca SEPA en página DID). */
export function isModel303RefundDeclarationType(declarationType: string): boolean {
  return declarationType === "D" || declarationType === "X" || declarationType === "V"
}
