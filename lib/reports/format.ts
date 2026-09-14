export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

export function normalizeCuenta(cuenta: string): string {
  return cuenta.replace(/\D/g, "").trim()
}

/** Una cuenta de grupo (410) incluye sus subcuentas (410.00001). */
export function accountMatchesQuery(storedCuenta: string, queryCuenta: string): boolean {
  const stored = normalizeCuenta(storedCuenta)
  const query = normalizeCuenta(queryCuenta)
  if (!stored || !query) return false
  if (stored === query) return true
  return stored.startsWith(query) && stored.length > query.length
}

export function cuentaSortKey(cuenta: string): string {
  return normalizeCuenta(cuenta).padEnd(12, "0")
}

export function getAccountLevel(cuenta: string): number {
  const digits = normalizeCuenta(cuenta)
  if (digits.length <= 2) return 0
  if (digits.length <= 3) return 1
  if (digits.length <= 5) return 2
  return 3
}

export function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function formatDateTimeEs(date: Date): string {
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
