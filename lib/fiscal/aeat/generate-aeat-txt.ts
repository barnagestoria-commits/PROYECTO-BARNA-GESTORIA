import type { FiscalModelDetailResponse, FiscalModelId } from "@/lib/types/fiscal-panorama"
import {
  buildModel303CasillaValues,
  model303CasillaEntries,
} from "@/lib/fiscal/model-303/official-layout"
import {
  buildOfficialCasillaEntries,
  OFFICIAL_CASILLA_LABELS,
} from "@/lib/fiscal/official-layouts"

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
    padLeft(casilla, 6, " "),
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

const MODEL303_CASILLA_LABELS: Record<string, string> = {
  "01": "BASE REGIMEN GENERAL 21",
  "03": "CUOTA REGIMEN GENERAL 21",
  "04": "BASE REGIMEN GENERAL 10",
  "06": "CUOTA REGIMEN GENERAL 10",
  "07": "BASE REGIMEN GENERAL 4",
  "09": "CUOTA REGIMEN GENERAL 4",
  "10": "BASE ADQ INTRACOMUNITARIAS",
  "11": "CUOTA ADQ INTRACOMUNITARIAS",
  "12": "BASE INV SUJETO PASIVO",
  "13": "CUOTA INV SUJETO PASIVO",
  "27": "TOTAL CUOTA DEVENGADA",
  "28": "BASE DEDUCIBLE INTERIOR CORRIENTE",
  "29": "CUOTA DEDUCIBLE INTERIOR CORRIENTE",
  "30": "BASE DEDUCIBLE INTERIOR INVERSION",
  "31": "CUOTA DEDUCIBLE INTERIOR INVERSION",
  "32": "BASE DEDUCIBLE IMPORT CORRIENTE",
  "33": "CUOTA DEDUCIBLE IMPORT CORRIENTE",
  "34": "BASE DEDUCIBLE IMPORT INVERSION",
  "35": "CUOTA DEDUCIBLE IMPORT INVERSION",
  "36": "BASE DEDUCIBLE INTRA CORRIENTE",
  "37": "CUOTA DEDUCIBLE INTRA CORRIENTE",
  "38": "BASE DEDUCIBLE INTRA INVERSION",
  "39": "CUOTA DEDUCIBLE INTRA INVERSION",
  "45": "TOTAL A DEDUCIR",
  "46": "DIFERENCIA 27 MENOS 45",
  "110": "COMPENSACION PERIODOS ANTERIORES",
  "71": "RESULTADO LIQUIDACION",
}

function casillaLabel(modelCode: FiscalModelId, code: string): string {
  return (
    (modelCode === "303" ? MODEL303_CASILLA_LABELS[code] : OFFICIAL_CASILLA_LABELS[modelCode]?.[code]) ??
    `CASILLA ${code}`
  )
}

function buildOfficialRecords(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string[] {
  const records = [buildIdentificationRecord(detail, companyName, companyCif)]
  const entries =
    detail.modelCode === "303"
      ? model303CasillaEntries(buildModel303CasillaValues(detail))
      : buildOfficialCasillaEntries(detail)

  for (const entry of entries) {
    records.push(buildAmountRecord(entry.code, entry.amount, casillaLabel(detail.modelCode, entry.code)))
  }

  const detailLines = detail.breakdown.flatMap((section) => section.lines)
  detailLines.forEach((line, index) => {
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
    `# Descargar e importar en la Sede Electronica de la AEAT`,
    "",
  ]

  const records = buildOfficialRecords(detail, companyName, companyCif)
  const content = [...header, ...records].join("\r\n")
  return Buffer.from(content, "latin1")
}

export function supportsAeatTxtImport(model: FiscalModelId): boolean {
  return model === "111" || model === "115" || model === "123" || model === "180" || model === "190" || model === "303" || model === "347" || model === "349" || model === "390"
}

export function shouldOfferAeatTxt(
  detail: Pick<FiscalModelDetailResponse, "modelCode" | "quarter">,
): boolean {
  const annualModels: FiscalModelId[] = ["180", "190", "347", "390"]
  if (annualModels.includes(detail.modelCode)) return detail.quarter === "annual"
  return detail.quarter !== "annual"
}
