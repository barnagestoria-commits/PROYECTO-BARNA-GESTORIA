/**
 * Fichero de presentación del modelo 130.
 * Diseño de registro DR130e15v12 (Orden HAP/258/2015, ejercicios 2019 y siguientes).
 * Página 01 de 600 posiciones, envolvente <T1300…> y bloque <AUX>.
 */
import { formatAeatNumAmount, formatAeatSignedAmount, normalizeNif } from "@gestoria/tax-engine"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export const MODEL_130_PAGE_LENGTH = 600
const AUX_BLOCK_LENGTH = 311
const SIGNED_CASILLAS = new Set(["03", "07", "11", "14", "17", "19"])

const CASILLA_POSITION: Record<string, number> = {
  "01": 109,
  "02": 126,
  "03": 143,
  "04": 160,
  "05": 177,
  "06": 194,
  "07": 211,
  "08": 228,
  "09": 245,
  "10": 262,
  "11": 279,
  "12": 296,
  "13": 313,
  "14": 330,
  "15": 347,
  "16": 364,
  "17": 381,
  "18": 398,
  "19": 415,
}

function createBlank(length: number): string[] {
  return Array.from({ length }, () => " ")
}

function writeAt(record: string[], position: number, value: string, length: number): void {
  const start = position - 1
  const normalized = value.slice(0, length).padEnd(length, " ")
  for (let index = 0; index < length; index += 1) {
    record[start + index] = normalized[index] ?? " "
  }
}

function writeAmount(record: string[], position: number, casilla: string, amount: number): void {
  const formatted = SIGNED_CASILLAS.has(casilla)
    ? formatAeatSignedAmount(amount)
    : formatAeatNumAmount(amount)
  writeAt(record, position, formatted, 17)
}

function aeatText(value: string, length: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/Ñ/g, "N")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length)
    .padEnd(length, " ")
}

function splitDeclarantName(companyName: string): { apellidos: string; nombre: string } {
  const value = companyName.trim().replace(/\s+/g, " ")
  if (value.includes(",")) {
    const [apellidos, nombre] = value.split(",", 2)
    return { apellidos: (apellidos ?? "").trim(), nombre: (nombre ?? "").trim() }
  }
  const parts = value.split(" ").filter(Boolean)
  if (parts.length <= 1) return { apellidos: value, nombre: "" }
  return { apellidos: parts.slice(0, -1).join(" "), nombre: parts[parts.length - 1] ?? "" }
}

function periodCode(quarter: FiscalModelDetailResponse["quarter"]): string {
  if (quarter === "annual") return "0A"
  return `${quarter}T`
}

function declarationType(casilla19: number): string {
  if (casilla19 > 0) return "I"
  if (casilla19 < 0) return "B"
  return "N"
}

function buildAuxBlock(companyCif: string | null | undefined): string {
  const configuredDeveloperNif = process.env.AEAT_DEVELOPER_NIF?.trim()
  const version = (process.env.AEAT_PROGRAM_VERSION?.trim() || "0102").slice(0, 4).padEnd(4, " ")
  const developerNif = normalizeNif(configuredDeveloperNif || companyCif)
  const aux = createBlank(AUX_BLOCK_LENGTH)
  writeAt(aux, 1, "<AUX>", 5)
  writeAt(aux, 76, version, 4)
  writeAt(aux, 84, developerNif, 9)
  writeAt(aux, 306, "</AUX>", 6)
  return aux.join("")
}

export function buildModel130Page(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string {
  const page = createBlank(MODEL_130_PAGE_LENGTH)
  const amounts = new Map(buildOfficialCasillaEntries(detail).map((entry) => [entry.code, entry.amount]))
  const casilla19 = amounts.get("19") ?? detail.amount
  const names = splitDeclarantName(companyName || " ")

  writeAt(page, 1, "<T13001000>", 11)
  writeAt(page, 13, declarationType(casilla19), 1)
  writeAt(page, 14, normalizeNif(companyCif), 9)
  writeAt(page, 23, aeatText(names.apellidos, 60), 60)
  writeAt(page, 83, aeatText(names.nombre, 20), 20)
  writeAt(page, 103, String(detail.year).padStart(4, "0").slice(0, 4), 4)
  writeAt(page, 107, periodCode(detail.quarter), 2)

  for (const [casilla, position] of Object.entries(CASILLA_POSITION)) {
    writeAmount(page, position, casilla, amounts.get(casilla) ?? 0)
  }

  writeAt(page, 589, "</T13001000>", 12)
  return page.join("")
}

export function buildModel130Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif).trim() || "SINNIF"
  return `${nif}${detail.year}${periodCode(detail.quarter)}.130`
}

export function generateModel130AeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const period = periodCode(detail.quarter)
  const opening = `<T1300${detail.year}${period}0000>`
  const closing = `</T1300${detail.year}${period}0000>`
  const content = opening + buildAuxBlock(companyCif) + buildModel130Page(detail, companyName, companyCif) + closing
  return Buffer.from(content, "latin1")
}
