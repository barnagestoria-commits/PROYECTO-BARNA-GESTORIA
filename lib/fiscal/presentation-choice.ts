import { AEAT_OFFICIAL_PORTALS, getAeatModelOfficialSource } from "@/lib/fiscal/aeat/official-sources"
import { shouldOfferAeatTxt } from "@/lib/fiscal/aeat/generate-aeat-txt"
import { shouldOfferLibrosRegistro } from "@/lib/fiscal/aeat/libros-registro/map-libros"
import type { FiscalExportFormat } from "@/lib/fiscal/export-formats"
import { isAnnualOnlyModel } from "@/lib/fiscal/fiscal-settings"
import type { FiscalModelId } from "@/lib/types/fiscal-panorama"

const FISCAL_MODEL_IDS: FiscalModelId[] = [
  "111",
  "115",
  "123",
  "130",
  "180",
  "190",
  "303",
  "347",
  "349",
  "390",
]

export function isFiscalModelId(value: string): value is FiscalModelId {
  return FISCAL_MODEL_IDS.includes(value as FiscalModelId)
}

export function parsePresentationQuarter(quarter: string | number): number | "annual" {
  if (quarter === "annual" || quarter === "anual") return "annual"
  const parsed = typeof quarter === "number" ? quarter : Number.parseInt(String(quarter), 10)
  if (parsed >= 1 && parsed <= 4) return parsed
  return "annual"
}

/** Los anuales (180, 190, 347, 390) se presentan en el ejercicio; el resto, en el trimestre. */
export function presentationQuarterForModel(
  modelCode: string,
  currentQuarter: string | number,
): number | "annual" {
  if (isFiscalModelId(modelCode) && isAnnualOnlyModel(modelCode)) return "annual"
  return parsePresentationQuarter(currentQuarter)
}

export function officialFormatsForModel(params: {
  modelCode: string
  quarter: string | number
}): FiscalExportFormat[] {
  const quarter = parsePresentationQuarter(params.quarter)
  const formats: FiscalExportFormat[] = []
  if (
    isFiscalModelId(params.modelCode) &&
    shouldOfferAeatTxt({ modelCode: params.modelCode, quarter })
  ) {
    formats.push("txt")
  }
  if (shouldOfferLibrosRegistro(params.modelCode, quarter)) formats.push("lsi")
  formats.push("zip")
  return formats
}

export function officialModelFileLabel(modelCode: string): string {
  return `Fichero AEAT .${modelCode}`
}

export function officialBooksLabel(): string {
  return "Libros Excel Hacienda"
}

export function officialPackLabel(): string {
  return "Guardar todo"
}

export interface FiscalPresentationChoice {
  modelCode: string
  headerTitle: string
  headerDescription: string
  sedeOptionLabel: string
  sedeUrl: string
  sedeTitle: string
  sedeDescription: string
  sedeCta: string
  certificateHref: string
  filesOptionLabel: string
  filesTitle: string
  filesDescription: string
  offersModelFile: boolean
  offersBooks: boolean
  offersOfficialPack: boolean
  modelFileLabel: string
  booksLabel: string
  packLabel: string
  modelFileHint: string
  booksHint: string
  packHint: string
}

export function getFiscalPresentationChoice(params: {
  modelCode: string
  quarter: string | number
}): FiscalPresentationChoice {
  const source = isFiscalModelId(params.modelCode) ? getAeatModelOfficialSource(params.modelCode) : null
  const officialFormats = officialFormatsForModel(params)
  const offersModelFile = officialFormats.includes("txt")
  const offersBooks = officialFormats.includes("lsi")

  return {
    modelCode: params.modelCode,
    headerTitle: "Cómo quieres presentar",
    headerDescription:
      "Tú eliges. Puedes presentar en la Sede de Hacienda o descargar los ficheros oficiales y subirlos tú. Si la conexión falla, con los archivos puedes presentar a tiempo.",
    sedeOptionLabel: "Opción 1",
    sedeUrl: source?.presentationPath ?? AEAT_OFFICIAL_PORTALS.declarationsByModel,
    sedeTitle: "Presentar en Hacienda",
    sedeDescription:
      "Abre el formulario oficial con tu certificado digital. Allí puedes cumplimentarlo o importar los ficheros de Barna.",
    sedeCta: `Abrir modelo ${params.modelCode} en la AEAT`,
    certificateHref: "/configuracion/certificado",
    filesOptionLabel: "Opción 2",
    filesTitle: "Presentar con ficheros",
    filesDescription:
      "Descarga los archivos oficiales y súbelos en la Sede. Tú decides cuál usar. Si la conexión con Hacienda no funciona, estos ficheros siguen valiendo.",
    offersModelFile,
    offersBooks,
    offersOfficialPack: officialFormats.includes("zip"),
    modelFileLabel: officialModelFileLabel(params.modelCode),
    booksLabel: officialBooksLabel(),
    packLabel: officialPackLabel(),
    modelFileHint: `Para importar y presentar el modelo ${params.modelCode} en la Sede.`,
    booksHint:
      params.modelCode === "130"
        ? "Para que Hacienda rellene ingresos y gastos del 130 desde tus facturas."
        : "Para que Hacienda rellene las casillas del Pre303 desde tus facturas.",
    packHint: "PDF, desglose interno y todos los ficheros oficiales, por si hay que presentar a mano.",
  }
}
