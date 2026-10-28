/** CNAE-2025 de cuatro cifras. Vacío borra el dato. Un valor a medias no se guarda. */
export function parseCnae(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  const digits = (value ?? "").replace(/\D/g, "")
  if (!digits) return null
  if (digits.length !== 4) {
    throw new Error("El CNAE de la actividad principal tiene que tener cuatro cifras.")
  }
  return digits
}
