function padLeft(value: string, length: number, char = "0"): string {
  return value.slice(0, length).padStart(length, char)
}

function padRight(value: string, length: number, char = " "): string {
  return value.slice(0, length).padEnd(length, char)
}

export function roundEuro(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function toCents(amount: number): number {
  return Math.round(Math.abs(roundEuro(amount)) * 100)
}

/** Importe Num (17 pos.) — 15 enteros + 2 decimales sin signo. */
export function formatAeatNumAmount(amount: number, length = 17): string {
  return padLeft(String(toCents(amount)), length, "0")
}

/** Importe N (17 pos.) — signo + 16 posiciones numéricas. */
export function formatAeatSignedAmount(amount: number, length = 17): string {
  const sign = amount < 0 ? "N" : " "
  const body = padLeft(String(toCents(amount)), length - 1, "0")
  return sign + body
}

/** Tipo porcentaje (5 pos.) — 3 enteros + 2 decimales, p. ej. 21% → 02100. */
export function formatAeatPercent(rate: number): string {
  const normalized = Math.round(rate * 100)
  return padLeft(String(normalized), 5, "0")
}

export function inferPercentFromBaseCuota(base: number, cuota: number): number {
  if (base <= 0 || cuota <= 0) return 0
  const rate = (cuota / base) * 100
  if (rate >= 19 && rate <= 22) return 21
  if (rate >= 9 && rate <= 11) return 10
  if (rate >= 3 && rate <= 5) return 4
  return Math.round(rate * 100) / 100
}

export function normalizeNif(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 9).padEnd(9, " ")
}

export function normalizeCompanyName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^\w\sÁÉÍÓÚÜÑ./-]/gi, "")
    .slice(0, 80)
    .padEnd(80, " ")
}

export function buildRecordBuffer(parts: string[]): Buffer {
  return Buffer.from(parts.join(""), "latin1")
}

export function padRecord(record: string[], length: number): string {
  const joined = record.join("")
  if (joined.length > length) return joined.slice(0, length)
  return joined + padRight("", length - joined.length)
}
