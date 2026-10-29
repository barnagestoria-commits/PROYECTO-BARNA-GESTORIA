/**
 * Fichero de presentación del modelo 111.
 * Diseño de registro DR111e16v18 (ejercicios 2016 y siguientes, página de 1.000 posiciones).
 * Envolvente <T1110…> y bloque <AUX>, igual que el resto de autoliquidaciones de la Sede.
 */
import { formatAeatNumAmount, normalizeNif } from "@gestoria/tax-engine"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export const MODEL_111_PAGE_LENGTH = 1000
const AUX_BLOCK_LENGTH = 311

/** Casillas de número de perceptores: 8 dígitos. El resto de importes ocupa 17. */
const COUNT_CASILLAS = new Set(["01", "04", "07", "10", "13", "16", "19", "22", "25"])

const CASILLA_POSITION: Record<string, number> = {
  "01": 109,
  "02": 117,
  "03": 134,
  "04": 151,
  "05": 159,
  "06": 176,
  "07": 193,
  "08": 201,
  "09": 218,
  "10": 235,
  "11": 243,
  "12": 260,
  "13": 277,
  "14": 285,
  "15": 302,
  "16": 319,
  "17": 327,
  "18": 344,
  "19": 361,
  "20": 369,
  "21": 386,
  "22": 403,
  "23": 411,
  "24": 428,
  "25": 445,
  "26": 453,
  "27": 470,
  "28": 487,
  "29": 504,
  "30": 521,
}

const RETENTION_CASILLAS = ["03", "06", "09", "12", "15", "18", "21", "24", "27"]

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

function formatCount(value: number): string {
  const digits = Math.max(0, Math.round(value))
  return String(digits).padStart(8, "0")
}

/** La Sede de 2026 rechaza la «N» de signo del diseño histórico. El negativo empieza por «-». */
function formatSignedAmount(amount: number): string {
  if (amount >= 0) return formatAeatNumAmount(amount)
  return `-${formatAeatNumAmount(amount, 16)}`
}

function aeatText(value: string, length: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/Ñ/g, "N")
    .replace(/\./g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length)
    .padEnd(length, " ")
}

function splitDeclarantName(companyName: string, companyTaxId: boolean): { apellidos: string; nombre: string } {
  if (companyTaxId) return { apellidos: companyName.trim(), nombre: "" }
  const value = companyName.trim().replace(/\s+/g, " ")
  if (value.includes(",")) {
    const [apellidos, nombre] = value.split(",", 2)
    return { apellidos: (apellidos ?? "").trim(), nombre: (nombre ?? "").trim() }
  }
  const parts = value.split(" ").filter(Boolean)
  if (parts.length <= 1) return { apellidos: value, nombre: "" }
  return { apellidos: parts.slice(0, -1).join(" "), nombre: parts[parts.length - 1] ?? "" }
}

export function model111FilePeriod(quarter: FiscalModelDetailResponse["quarter"]): string | null {
  if (quarter === "annual") return null
  return `${quarter}T`
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

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function buildModel111Page(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string {
  const page = createBlank(MODEL_111_PAGE_LENGTH)
  const amounts = new Map(buildOfficialCasillaEntries(detail).map((entry) => [entry.code, entry.amount]))
  const suma = round2(RETENTION_CASILLAS.reduce((sum, code) => sum + (amounts.get(code) ?? 0), 0))
  const anteriores = amounts.get("29") ?? 0
  const aIngresar = Math.max(0, round2(suma - anteriores))
  amounts.set("28", suma)
  amounts.set("30", aIngresar)

  const nif = normalizeNif(companyCif)
  const companyTaxId = /^[ABCDEFGHJNPQRSUVW]/.test(nif.trim())
  const names = splitDeclarantName(companyName || " ", companyTaxId)
  const period = model111FilePeriod(detail.quarter) ?? "1T"

  writeAt(page, 1, "<T11101000>", 11)
  writeAt(page, 13, aIngresar > 0 ? "I" : "N", 1)
  writeAt(page, 14, nif, 9)
  writeAt(page, 23, aeatText(names.apellidos, 60), 60)
  writeAt(page, 83, aeatText(names.nombre, 20), 20)
  writeAt(page, 103, String(detail.year).padStart(4, "0").slice(0, 4), 4)
  writeAt(page, 107, period, 2)

  for (const [casilla, position] of Object.entries(CASILLA_POSITION)) {
    const amount = amounts.get(casilla) ?? 0
    if (COUNT_CASILLAS.has(casilla)) {
      writeAt(page, position, formatCount(amount), 8)
    } else if (casilla === "29") {
      writeAt(page, position, formatSignedAmount(amount), 17)
    } else {
      writeAt(page, position, formatAeatNumAmount(amount), 17)
    }
  }

  writeAt(page, 989, "</T11101000>", 12)
  return page.join("")
}

export function buildModel111Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif).trim() || "SINNIF"
  const period = model111FilePeriod(detail.quarter) ?? "0A"
  return `${nif}${detail.year}${period}.111`
}

export function generateModel111AeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const period = model111FilePeriod(detail.quarter)
  if (!period) {
    throw new Error("El modelo 111 se presenta por trimestre. El resumen anual es el modelo 190.")
  }
  const opening = `<T1110${detail.year}${period}0000>`
  const closing = `</T1110${detail.year}${period}0000>`
  const content = opening + buildAuxBlock(companyCif) + buildModel111Page(detail, companyName, companyCif) + closing
  return Buffer.from(content, "latin1")
}
