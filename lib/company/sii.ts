export const COMPANY_SII_MODES = ["NONE", "OBLIGATORIO", "VOLUNTARIO"] as const

export type CompanySiiMode = (typeof COMPANY_SII_MODES)[number]

export interface CompanyVatCensus {
  siiMode: CompanySiiMode
  cashBasisSubject: boolean
  cashBasisRecipient: boolean
}

export const SII_MODE_OPTIONS: Array<{ id: CompanySiiMode; label: string }> = [
  { id: "NONE", label: "No lleva SII" },
  { id: "OBLIGATORIO", label: "SII obligatorio" },
  { id: "VOLUNTARIO", label: "SII voluntario" },
]

export function siiModeLabel(mode: CompanySiiMode | null | undefined): string {
  return SII_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? "No lleva SII"
}

export function yesNoLabel(value: boolean | null | undefined): string {
  return value ? "Sí" : "No"
}

export function parseSiiMode(value: unknown): CompanySiiMode | undefined {
  if (value === undefined) return undefined
  if (value === "NONE" || value === "OBLIGATORIO" || value === "VOLUNTARIO") return value
  throw new Error("El régimen de SII no es válido.")
}

export function parseCensusBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value === "boolean") return value
  throw new Error("La respuesta de criterio de caja no es válida.")
}

/** Si el censo nuevo está vacío y el impreso antiguo marcaba SII, se muestra como voluntario. */
export function resolveCompanySiiMode(
  stored: CompanySiiMode | null | undefined,
  legacySiiEnabled?: boolean,
): CompanySiiMode {
  if (stored === "OBLIGATORIO" || stored === "VOLUNTARIO") return stored
  if (legacySiiEnabled) return "VOLUNTARIO"
  return "NONE"
}
