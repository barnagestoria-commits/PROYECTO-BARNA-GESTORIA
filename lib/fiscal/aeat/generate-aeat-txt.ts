import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"

const RECORD_LENGTH = 500

function normalizeNif(value: string | null | undefined): string {
  return (value ?? "000000000").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 9).padEnd(9, " ")
}

function padLeft(value: string, length: number, char = "0"): string {
  return value.slice(0, length).padStart(length, char)
}

function padRight(value: string, length: number, char = " "): string {
  return value.slice(0, length).padEnd(length, char)
}

function formatAeatAmount(amount: number): string {
  return padLeft(Math.round(Math.abs(amount) * 100).toString(), 15)
}

function formatSignedAmount(amount: number): string {
  const sign = amount < 0 ? "N" : " "
  return `${sign}${formatAeatAmount(amount)}`
}

function buildRecord(parts: string[]): string {
  const line = parts.join("")
  return padRight(line, RECORD_LENGTH)
}

function quarterCode(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "5"
  return String(quarter)
}

function periodLabelForFile(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "0A"
  return `${quarter}T`
}

export function buildAeatTxtFilename(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif).trim() || "SINNIF"
  const period = periodLabelForFile(detail.quarter)
  return `${detail.modelCode}${detail.year}${period}_${nif}.txt`
}

function buildIdentificationRecord(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string {
  return buildRecord([
    "1",
    padRight(detail.modelCode, 3),
    normalizeNif(companyCif),
    padRight(companyName.toUpperCase(), 40),
    padLeft(String(detail.year), 4),
    quarterCode(detail.quarter),
    padRight(detail.periodLabel.toUpperCase(), 20),
    padRight("BARNA GESTORIA", 20),
  ])
}

function buildAmountRecord(casilla: string, amount: number, label: string): string {
  return buildRecord([
    "2",
    padRight(casilla, 6),
    formatSignedAmount(amount),
    padRight(label.toUpperCase(), 80),
  ])
}

function buildDetailRecord(
  index: number,
  line: FiscalModelDetailResponse["breakdown"][number]["lines"][number],
): string {
  return buildRecord([
    "3",
    padLeft(String(index + 1), 4),
    padRight(line.entryDate.replace(/-/g, ""), 8),
    padRight(line.cuenta.replace(/\D/g, "").slice(0, 8), 8),
    formatSignedAmount(line.signedAmount),
    padRight((line.concepto || "SIN CONCEPTO").toUpperCase(), 80),
  ])
}

function build303Records(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string[] {
  const repercutido = detail.breakdown.find((section) => section.key === "repercutido")?.total ?? 0
  const soportado = detail.breakdown.find((section) => section.key === "soportado")?.total ?? 0
  const resultado = detail.amount

  return [
    buildIdentificationRecord(detail, companyName, companyCif),
    buildAmountRecord("01", repercutido, "IVA repercutido"),
    buildAmountRecord("02", soportado, "IVA soportado"),
    buildAmountRecord("03", resultado, "Resultado liquidacion IVA"),
    buildRecord(["9", padRight("FIN REGISTRO MODELO 303", 40)]),
  ]
}

function buildRetentionRecords(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string[] {
  const lines = detail.breakdown.flatMap((section) => section.lines)
  const records = [
    buildIdentificationRecord(detail, companyName, companyCif),
    buildAmountRecord("01", detail.amount, "Total retenciones e ingresos a cuenta"),
  ]

  lines.forEach((line, index) => {
    records.push(buildDetailRecord(index, line))
  })

  records.push(buildRecord(["9", padRight(`FIN REGISTRO MODELO ${detail.modelCode}`, 40)]))
  return records
}

export function generateAeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const header = [
    `# IMPORTACION TELEMATICA AEAT - MODELO ${detail.modelCode}`,
    `# EJERCICIO ${detail.year} PERIODO ${detail.periodLabel}`,
    `# NIF ${normalizeNif(companyCif).trim()}`,
    `# GENERADO POR BARNA GESTORIA`,
    `# FORMATO: REGISTROS DE ANCHURA FIJA (${RECORD_LENGTH}) PARA IMPORTACION .TXT`,
    "",
  ]

  let records: string[]
  if (detail.modelCode === "303") {
    records = build303Records(detail, companyName, companyCif)
  } else {
    records = buildRetentionRecords(detail, companyName, companyCif)
  }

  const content = [...header, ...records].join("\r\n")
  return Buffer.from(content, "latin1")
}

export function supportsAeatTxtImport(model: FiscalModelId): boolean {
  return model === "111" || model === "115" || model === "303" || model === "180"
}

export function shouldOfferAeatTxt(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "quarter">,
): boolean {
  if (detail.modelCode === "180") return detail.quarter === "annual"
  return detail.quarter !== "annual"
}
