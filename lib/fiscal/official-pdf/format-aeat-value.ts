export function formatAeatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "0,00"
  const negative = amount < 0
  const abs = Math.abs(amount)
  const [intPart, decPart = "00"] = abs.toFixed(2).split(".")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${negative ? "-" : ""}${grouped},${decPart}`
}

export function formatAeatInteger(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0"
  return String(Math.round(value))
}

export function formatAeatPeriod(quarter: number | "annual"): string {
  if (quarter === "annual") return "0A"
  return `${quarter}T`
}

export function sanitizeAeatText(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^\w\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}
