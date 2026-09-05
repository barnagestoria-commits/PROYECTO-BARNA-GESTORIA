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

export function isValidSpanishTaxId(value: string | null | undefined): boolean {
  const normalized = (value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase()
  const controlLetters = "TRWAGMYFPDXBNJZSQVHLCKE"

  if (/^\d{8}[A-Z]$/.test(normalized)) {
    return normalized[8] === controlLetters[Number(normalized.slice(0, 8)) % 23]
  }

  if (/^[XYZ]\d{7}[A-Z]$/.test(normalized)) {
    const number = Number(
      `${({ X: "0", Y: "1", Z: "2" } as const)[normalized[0] as "X" | "Y" | "Z"]}${normalized.slice(1, 8)}`,
    )
    return normalized[8] === controlLetters[number % 23]
  }

  if (/^[KLM]\d{7}[A-Z]$/.test(normalized)) {
    return normalized[8] === controlLetters[Number(normalized.slice(1, 8)) % 23]
  }

  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(normalized)) {
    return false
  }

  const digits = normalized.slice(1, 8).split("").map(Number)
  const evenSum = digits[1] + digits[3] + digits[5]
  const oddSum = [digits[0], digits[2], digits[4], digits[6]].reduce((sum, digit) => {
    const doubled = digit * 2
    return sum + Math.floor(doubled / 10) + (doubled % 10)
  }, 0)
  const controlDigit = (10 - ((evenSum + oddSum) % 10)) % 10
  const controlLetter = "JABCDEFGHI"[controlDigit]
  const actualControl = normalized[8]

  if ("ABEH".includes(normalized[0])) return actualControl === String(controlDigit)
  if ("KPQS".includes(normalized[0])) return actualControl === controlLetter
  return actualControl === String(controlDigit) || actualControl === controlLetter
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
