/**
 * Fichero de presentación del modelo 115.
 * Diseño DR115e15v13 (Orden EHA/3435/2007, ejercicios 2019 y siguientes).
 * Envolvente de 17, AUX de 311 y página de 500. La hoja 01 empieza en la posición 329.
 */
import { formatAeatNumAmount, isValidSpanishTaxId, normalizeNif } from "@gestoria/tax-engine"
import { buildOfficialCasillaEntries } from "@/lib/fiscal/official-layouts"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

export const MODEL_115_PAGE_LENGTH = 500
const AUX_BLOCK_LENGTH = 311

/** Casilla 01: número de perceptores, 15 dígitos. El resto de importes ocupa 17. */
const CASILLA_POSITION: Record<string, number> = {
  "01": 109,
  "02": 124,
  "03": 141,
  "04": 158,
  "05": 175,
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

function formatCount(value: number): string {
  return String(Math.max(0, Math.round(value))).padStart(15, "0").slice(-15)
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

export function model115FilePeriod(quarter: FiscalModelDetailResponse["quarter"]): string | null {
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

export function buildModel115Page(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): string {
  const page = createBlank(MODEL_115_PAGE_LENGTH)
  const amounts = new Map(buildOfficialCasillaEntries(detail).map((entry) => [entry.code, entry.amount]))
  const retenciones = amounts.get("03") ?? 0
  const anteriores = amounts.get("04") ?? 0
  const aIngresar = Math.max(0, round2(retenciones - anteriores))
  amounts.set("05", aIngresar)

  const nif = normalizeNif(companyCif)
  const companyTaxId = /^[ABCDEFGHJNPQRSUVW]/.test(nif.trim())
  const names = splitDeclarantName(companyName || " ", companyTaxId)
  const period = model115FilePeriod(detail.quarter) ?? "1T"

  writeAt(page, 1, "<T11501000>", 11)
  writeAt(page, 13, aIngresar > 0 ? "I" : "N", 1)
  writeAt(page, 14, nif, 9)
  writeAt(page, 23, aeatText(names.apellidos, 60), 60)
  writeAt(page, 83, aeatText(names.nombre, 20), 20)
  writeAt(page, 103, String(detail.year).padStart(4, "0").slice(0, 4), 4)
  writeAt(page, 107, period, 2)

  for (const [casilla, position] of Object.entries(CASILLA_POSITION)) {
    const amount = amounts.get(casilla) ?? 0
    writeAt(page, position, casilla === "01" ? formatCount(amount) : formatAeatNumAmount(amount), casilla === "01" ? 15 : 17)
  }

  writeAt(page, 489, "</T11501000>", 12)
  return page.join("")
}

export function buildModel115Filename(
  detail: Pick<FiscalModelDetailResponse, "year" | "quarter">,
  companyCif: string | null | undefined,
): string {
  const nif = normalizeNif(companyCif).trim() || "SINNIF"
  const period = model115FilePeriod(detail.quarter) ?? "0A"
  return `${nif}${detail.year}${period}.115`
}

export interface Model115FileIssue {
  code: string
  message: string
}

function readDigits(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  return Number(raw)
}

/** Comprueba el fichero contra el diseño v1.3 antes de dejarlo descargar. */
export function model115ContentIssues(content: string, year: number, period: string): Model115FileIssue[] {
  const issues: Model115FileIssue[] = []
  const opening = `<T1150${year}${period}0000>`
  const closing = `</T1150${year}${period}0000>`
  if (!content.startsWith(opening) || !content.endsWith(closing) || content.includes("\n") || content.includes("\r")) {
    issues.push({
      code: "DR115_ENVELOPE",
      message: "El fichero del modelo 115 no tiene la envolvente <T1150…> del diseño DR115.",
    })
    return issues
  }

  const auxStart = opening.length
  const aux = content.slice(auxStart, auxStart + AUX_BLOCK_LENGTH)
  const pageStart = auxStart + AUX_BLOCK_LENGTH
  const page = content.slice(pageStart, pageStart + MODEL_115_PAGE_LENGTH)
  const expectedLength = opening.length + AUX_BLOCK_LENGTH + MODEL_115_PAGE_LENGTH + closing.length
  if (
    aux.length !== AUX_BLOCK_LENGTH ||
    !aux.startsWith("<AUX>") ||
    !aux.endsWith("</AUX>") ||
    page.length !== MODEL_115_PAGE_LENGTH ||
    !page.startsWith("<T11501000>") ||
    !page.endsWith("</T11501000>") ||
    content.length !== expectedLength ||
    content.indexOf("<T11501000>") !== pageStart
  ) {
    issues.push({
      code: "DR115_PAGE",
      message: "La página del modelo 115 no ocupa 500 posiciones a partir de la 329. La Sede rechazaría el fichero.",
    })
    return issues
  }

  const tipo = page[12] ?? " "
  if (!"INUG".includes(tipo)) {
    issues.push({ code: "DR115_TIPO", message: "El tipo de declaración debe ser I, N, U o G." })
  }
  if (page[11] !== " ") {
    issues.push({
      code: "DR115_COMPLEMENTARIA",
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
    issues.push({ code: "DECLARANT_NAME", message: "Falta la razón social de la empresa." })
  } else if (!/^[A-Z0-9 ]+$/.test(apellidos) || !/^[A-Z0-9 ]*$/.test(nombre)) {
    issues.push({
      code: "DR115_NAME",
      message: "La razón social contiene caracteres que la Sede no admite.",
    })
  }

  const developerNif = aux.slice(83, 92).trim()
  if (!isValidSpanishTaxId(developerNif)) {
    issues.push({
      code: "DR115_DEVELOPER_NIF",
      message: "El NIF de la empresa desarrolladora del bloque AUX no es válido.",
    })
  }

  const amounts = new Map<string, number>()
  for (const [casilla, position] of Object.entries(CASILLA_POSITION)) {
    const length = casilla === "01" ? 15 : 17
    const raw = page.slice(position - 1, position - 1 + length)
    const digits = readDigits(raw)
    const amount = digits === null ? null : digits / (casilla === "01" ? 1 : 100)
    if (amount === null) {
      issues.push({
        code: "DR115_CASILLA",
        message: `La casilla ${casilla} tiene caracteres que la Sede marcaría como no válidos.`,
      })
    } else {
      amounts.set(casilla, amount)
    }
  }

  const retenciones = amounts.get("03")
  const anteriores = amounts.get("04")
  const resultado = amounts.get("05")
  const base = amounts.get("02")
  if (retenciones !== undefined && anteriores !== undefined && resultado !== undefined) {
    const expected = Math.max(0, round2(retenciones - anteriores))
    if (Math.abs(resultado - expected) > 0.001) {
      issues.push({
        code: "DR115_RESULTADO",
        message: "La casilla 05 no coincide con las retenciones menos el resultado de declaraciones anteriores.",
      })
    }
    if (tipo === "I" && resultado <= 0) {
      issues.push({ code: "DR115_TIPO", message: "Una declaración a ingresar no puede llevar resultado cero." })
    }
    if (tipo === "N" && resultado > 0) {
      issues.push({ code: "DR115_TIPO", message: "Una declaración negativa no puede llevar resultado a ingresar." })
    }
  }
  if (base !== undefined && retenciones !== undefined && retenciones > 0 && base + 0.001 < retenciones) {
    issues.push({
      code: "DR115_BASE",
      message: "La base de las retenciones es menor que el importe retenido. La Sede rechazaría el fichero.",
    })
  }

  if (!/^ *$/.test(page.slice(239, 475))) {
    issues.push({
      code: "DR115_RESERVED",
      message: "Hay datos en la zona reservada de la página. La Sede rechazaría el fichero.",
    })
  }

  return issues
}

export function generateModel115AeatTxt(
  detail: FiscalModelDetailResponse,
  companyName: string,
  companyCif: string | null | undefined,
): Buffer {
  const period = model115FilePeriod(detail.quarter)
  if (!period) {
    throw new Error("El modelo 115 se presenta por trimestre. El resumen anual es el modelo 180.")
  }
  const opening = `<T1150${detail.year}${period}0000>`
  const closing = `</T1150${detail.year}${period}0000>`
  const content = opening + buildAuxBlock(companyCif) + buildModel115Page(detail, companyName, companyCif) + closing
  return Buffer.from(content, "latin1")
}
