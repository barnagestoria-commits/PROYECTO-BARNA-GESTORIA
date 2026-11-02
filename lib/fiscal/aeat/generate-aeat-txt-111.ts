/**
 * Fichero de presentación del modelo 111.
 * Diseño DR111e16v18 (Orden EHA/3127/2009, ejercicios 2019 y siguientes,
 * hoja actualizada en 2026). Envolvente de 17, AUX de 311 y página de 1.000.
 * La hoja 01 empieza en la posición 329 del fichero.
 */
import { formatAeatNumAmount, isValidSpanishTaxId, normalizeNif } from "@gestoria/tax-engine"
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

export interface Model111FileIssue {
  code: string
  message: string
}

function readDigits(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  return Number(raw)
}

function readSignedCasilla(raw: string): number | null {
  if (/^\d{17}$/.test(raw)) return Number(raw) / 100
  if (/^[-N]\d{16}$/.test(raw)) {
    const sign = raw[0] === "-" || raw[0] === "N" ? -1 : 1
    return (sign * Number(raw.slice(1))) / 100
  }
  return null
}

/** Comprueba el fichero contra el diseño v1.8 antes de dejarlo descargar. */
export function model111ContentIssues(content: string, year: number, period: string): Model111FileIssue[] {
  const issues: Model111FileIssue[] = []
  const opening = `<T1110${year}${period}0000>`
  const closing = `</T1110${year}${period}0000>`
  if (!content.startsWith(opening) || !content.endsWith(closing) || content.includes("\n") || content.includes("\r")) {
    issues.push({
      code: "DR111_ENVELOPE",
      message: "El fichero del modelo 111 no tiene la envolvente <T1110…> del diseño DR111.",
    })
    return issues
  }

  const auxStart = opening.length
  const aux = content.slice(auxStart, auxStart + AUX_BLOCK_LENGTH)
  const pageStart = auxStart + AUX_BLOCK_LENGTH
  const page = content.slice(pageStart, pageStart + MODEL_111_PAGE_LENGTH)
  const expectedLength = opening.length + AUX_BLOCK_LENGTH + MODEL_111_PAGE_LENGTH + closing.length
  if (
    aux.length !== AUX_BLOCK_LENGTH ||
    !aux.startsWith("<AUX>") ||
    !aux.endsWith("</AUX>") ||
    page.length !== MODEL_111_PAGE_LENGTH ||
    !page.startsWith("<T11101000>") ||
    !page.endsWith("</T11101000>") ||
    content.length !== expectedLength ||
    content.indexOf("<T11101000>") !== pageStart
  ) {
    issues.push({
      code: "DR111_PAGE",
      message: "La página del modelo 111 no ocupa 1.000 posiciones a partir de la 329. La Sede rechazaría el fichero.",
    })
    return issues
  }

  const tipo = page[12] ?? " "
  if (!"INUG".includes(tipo)) {
    issues.push({
      code: "DR111_TIPO",
      message: "El tipo de declaración debe ser I, N, U o G.",
    })
  }
  if (page[11] !== " ") {
    issues.push({
      code: "DR111_COMPLEMENTARIA",
      message: "El indicador de página complementaria tiene que ir en blanco.",
    })
  }

  const nif = page.slice(13, 22)
  if (!/^[A-Z0-9]{9}$/.test(nif) || !isValidSpanishTaxId(nif)) {
    issues.push({
      code: "DECLARANT_NIF",
      message: "El NIF de la empresa no es válido. Hacienda rechazaría el fichero.",
    })
  }
  const apellidos = page.slice(22, 82)
  const nombre = page.slice(82, 102)
  if (!apellidos.trim()) {
    issues.push({
      code: "DECLARANT_NAME",
      message: "Falta la razón social de la empresa.",
    })
  } else if (!/^[A-Z0-9 ]+$/.test(apellidos) || !/^[A-Z0-9 ]*$/.test(nombre)) {
    issues.push({
      code: "DR111_NAME",
      message: "La razón social contiene caracteres que la Sede no admite.",
    })
  }

  const developerNif = aux.slice(83, 92).trim()
  if (!isValidSpanishTaxId(developerNif)) {
    issues.push({
      code: "DR111_DEVELOPER_NIF",
      message: "El NIF de la empresa desarrolladora del bloque AUX no es válido.",
    })
  }
  if (!/^[A-Z0-9 ]{4}$/.test(aux.slice(75, 79))) {
    issues.push({
      code: "DR111_VERSION",
      message: "La versión del programa en el bloque AUX tiene caracteres no admitidos.",
    })
  }

  const amounts = new Map<string, number>()
  for (const [casilla, position] of Object.entries(CASILLA_POSITION)) {
    const length = COUNT_CASILLAS.has(casilla) ? 8 : 17
    const raw = page.slice(position - 1, position - 1 + length)
    const digits = readDigits(raw)
    const amount =
      casilla === "29" ? readSignedCasilla(raw) : digits === null ? null : digits / (COUNT_CASILLAS.has(casilla) ? 1 : 100)
    if (amount === null) {
      issues.push({
        code: "DR111_CASILLA",
        message: `La casilla ${casilla} tiene caracteres que la Sede marcaría como no válidos.`,
      })
    } else {
      amounts.set(casilla, amount)
    }
  }

  const suma = round2(RETENTION_CASILLAS.reduce((sum, code) => sum + (amounts.get(code) ?? 0), 0))
  const casilla28 = amounts.get("28")
  const casilla29 = amounts.get("29")
  const casilla30 = amounts.get("30")
  if (casilla28 !== undefined && Math.abs(casilla28 - suma) > 0.001) {
    issues.push({
      code: "DR111_SUMA",
      message: "La casilla 28 no coincide con la suma de retenciones e ingresos a cuenta.",
    })
  }
  if (casilla28 !== undefined && casilla29 !== undefined && casilla30 !== undefined) {
    const expected = Math.max(0, round2(casilla28 - casilla29))
    if (Math.abs(casilla30 - expected) > 0.001) {
      issues.push({
        code: "DR111_RESULTADO",
        message: "La casilla 30 no coincide con el resultado a ingresar.",
      })
    }
    if (tipo === "I" && casilla30 <= 0) {
      issues.push({
        code: "DR111_TIPO",
        message: "Una declaración a ingresar no puede llevar resultado cero.",
      })
    }
    if (tipo === "N" && casilla30 > 0) {
      issues.push({
        code: "DR111_TIPO",
        message: "Una declaración negativa no puede llevar resultado a ingresar.",
      })
    }
  }

  if (!/^ *$/.test(page.slice(586, 975))) {
    issues.push({
      code: "DR111_RESERVED",
      message: "Hay datos en la zona reservada de la página. La Sede rechazaría el fichero.",
    })
  }

  return issues
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
