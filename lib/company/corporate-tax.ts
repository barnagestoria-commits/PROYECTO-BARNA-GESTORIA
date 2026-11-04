export const CORPORATE_TAX_CHARACTERS = [
  "SOCIEDAD",
  "ENTIDAD_CREDITO",
  "ASEGURADORA",
  "INVERSION_COLECTIVA",
  "GARANTIA_RECIPROCA",
  "NO_SUJETA",
] as const

export type CorporateTaxCharacter = (typeof CORPORATE_TAX_CHARACTERS)[number]

export const CORPORATE_TAX_CHARACTER_OPTIONS: Array<{ id: CorporateTaxCharacter; label: string }> = [
  { id: "SOCIEDAD", label: "Sociedad (plan normal, abreviado o pyme)" },
  { id: "ENTIDAD_CREDITO", label: "Entidad de crédito" },
  { id: "ASEGURADORA", label: "Aseguradora" },
  { id: "INVERSION_COLECTIVA", label: "Institución de inversión colectiva" },
  { id: "GARANTIA_RECIPROCA", label: "Sociedad de garantía recíproca" },
  { id: "NO_SUJETA", label: "No presenta el impuesto sobre sociedades" },
]

export function corporateTaxCharacterLabel(
  value: CorporateTaxCharacter | null | undefined,
): string {
  return (
    CORPORATE_TAX_CHARACTER_OPTIONS.find((option) => option.id === value)?.label ??
    "Sociedad (plan normal, abreviado o pyme)"
  )
}

export function parseCorporateTaxCharacter(value: unknown): CorporateTaxCharacter | undefined {
  if (value === undefined) return undefined
  if (
    typeof value === "string" &&
    CORPORATE_TAX_CHARACTERS.includes(value as CorporateTaxCharacter)
  ) {
    return value as CorporateTaxCharacter
  }
  throw new Error("El carácter de la sociedad no es válido.")
}
