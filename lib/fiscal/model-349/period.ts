/** Periodo del modelo 349: trimestre 1T-4T o mes 01-12. */
export const MODEL_349_PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1T", label: "1T · Primer trimestre" },
  { value: "2T", label: "2T · Segundo trimestre" },
  { value: "3T", label: "3T · Tercer trimestre" },
  { value: "4T", label: "4T · Cuarto trimestre" },
  { value: "01", label: "01 · Enero" },
  { value: "02", label: "02 · Febrero" },
  { value: "03", label: "03 · Marzo" },
  { value: "04", label: "04 · Abril" },
  { value: "05", label: "05 · Mayo" },
  { value: "06", label: "06 · Junio" },
  { value: "07", label: "07 · Julio" },
  { value: "08", label: "08 · Agosto" },
  { value: "09", label: "09 · Septiembre" },
  { value: "10", label: "10 · Octubre" },
  { value: "11", label: "11 · Noviembre" },
  { value: "12", label: "12 · Diciembre" },
]

export function parseModel349Period(value: unknown): string | null {
  const raw = String(value ?? "").trim().toUpperCase()
  if (/^[1-4]T$/.test(raw)) return raw
  if (/^(0[1-9]|1[0-2])$/.test(raw)) return raw
  return null
}

export function parseRectifiedYear(value: unknown): number | null {
  if (value == null || value === "") return null
  const year = Number(value)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  return year
}

export function parseDeclaredBase(value: unknown): number | null {
  if (value == null || value === "") return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100) / 100
}
