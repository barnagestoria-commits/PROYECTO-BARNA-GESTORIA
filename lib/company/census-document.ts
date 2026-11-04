import { isValidSpanishTaxId } from "@gestoria/tax-engine"
import {
  corporateTaxCharacterLabel,
  type CorporateTaxCharacter,
} from "@/lib/company/corporate-tax"
import { siiModeLabel, type CompanySiiMode } from "@/lib/company/sii"

export const CENSUS_DOCUMENT_KINDS = ["M036", "M037", "CERTIFICADO_CENSAL"] as const

export type CensusDocumentKind = (typeof CENSUS_DOCUMENT_KINDS)[number]

export interface CensusReading {
  kind: CensusDocumentKind
  nif: string | null
  cnae: string | null
  corporateTaxCharacter: CorporateTaxCharacter | null
  siiMode: CompanySiiMode | null
  cashBasisSubject: boolean | null
}

export interface CensusProfileSnapshot {
  cif: string | null
  cnae: string | null
  corporateTaxCharacter: CorporateTaxCharacter
  siiMode: CompanySiiMode
  cashBasisSubject: boolean
}

export interface CensusContrastRow {
  field: "nif" | "cnae" | "corporateTaxCharacter" | "siiMode" | "cashBasisSubject"
  label: string
  profile: string
  document: string
  status: "match" | "differ" | "missing"
}

export interface CensusSuggestion {
  cif?: string
  cnae?: string
  corporateTaxCharacter?: CorporateTaxCharacter
  siiMode?: CompanySiiMode
  cashBasisSubject?: boolean
}

export interface CensusContrast {
  nifMatches: boolean
  rows: CensusContrastRow[]
  suggestion: CensusSuggestion | null
}

const MIN_TEXT_LENGTH = 80

export function censusDocumentKindLabel(kind: CensusDocumentKind | string | null | undefined): string {
  if (kind === "M036") return "Modelo 036"
  if (kind === "M037") return "Modelo 037"
  if (kind === "CERTIFICADO_CENSAL") return "Certificado de situación censal"
  return "Documento censal"
}

export function parseCensusDocumentText(text: string): CensusReading {
  const source = text.replace(/\s+/g, " ").trim()
  if (source.length < MIN_TEXT_LENGTH) {
    throw new Error(
      "El PDF no trae texto. Si es una foto o un escaneo, descarga el certificado de situación censal en PDF desde la Sede.",
    )
  }

  const plain = stripAccents(source)
  const kind = detectKind(plain)
  const nif = findNif(source)
  if (!nif) {
    throw new Error(
      "No veo un NIF en el documento. Sube el 036 o el 037 ya presentado, o el certificado de situación censal.",
    )
  }

  return {
    kind,
    nif,
    cnae: findCnae(source),
    corporateTaxCharacter: readCharacter(plain, kind),
    siiMode: readSii(plain),
    cashBasisSubject: readCashBasis(plain),
  }
}

export function contrastCensus(
  profile: CensusProfileSnapshot,
  reading: CensusReading,
): CensusContrast {
  const profileNif = normalizeTaxId(profile.cif)
  const documentNif = reading.nif
  const nifMatches = !profileNif || profileNif === documentNif
  const rows: CensusContrastRow[] = [
    {
      field: "nif",
      label: "NIF",
      profile: profileNif || "Sin indicar",
      document: documentNif || "Sin indicar",
      status: !profileNif ? "missing" : profileNif === documentNif ? "match" : "differ",
    },
  ]

  if (reading.cnae) {
    rows.push(
      compareText("cnae", "CNAE", profile.cnae, reading.cnae),
    )
  }
  if (reading.corporateTaxCharacter) {
    rows.push({
      field: "corporateTaxCharacter",
      label: "Sociedades",
      profile: corporateTaxCharacterLabel(profile.corporateTaxCharacter),
      document: corporateTaxCharacterLabel(reading.corporateTaxCharacter),
      status:
        profile.corporateTaxCharacter === reading.corporateTaxCharacter ? "match" : "differ",
    })
  }
  if (reading.siiMode) {
    rows.push({
      field: "siiMode",
      label: "SII",
      profile: siiModeLabel(profile.siiMode),
      document: siiModeLabel(reading.siiMode),
      status: profile.siiMode === reading.siiMode ? "match" : "differ",
    })
  }
  if (reading.cashBasisSubject !== null) {
    rows.push({
      field: "cashBasisSubject",
      label: "Criterio de caja",
      profile: yesNo(profile.cashBasisSubject),
      document: yesNo(reading.cashBasisSubject),
      status: profile.cashBasisSubject === reading.cashBasisSubject ? "match" : "differ",
    })
  }

  if (!nifMatches) {
    return { nifMatches: false, rows, suggestion: null }
  }

  const suggestion: CensusSuggestion = {}
  if (!profileNif && documentNif) suggestion.cif = documentNif
  if (reading.cnae && reading.cnae !== (profile.cnae ?? "")) suggestion.cnae = reading.cnae
  if (
    reading.corporateTaxCharacter &&
    reading.corporateTaxCharacter !== profile.corporateTaxCharacter
  ) {
    suggestion.corporateTaxCharacter = reading.corporateTaxCharacter
  }
  if (reading.siiMode && reading.siiMode !== profile.siiMode) suggestion.siiMode = reading.siiMode
  if (
    reading.cashBasisSubject !== null &&
    reading.cashBasisSubject !== profile.cashBasisSubject
  ) {
    suggestion.cashBasisSubject = reading.cashBasisSubject
  }

  return { nifMatches: true, rows, suggestion }
}

export function parseStoredCensusReading(value: string | null | undefined): CensusReading | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<CensusReading>
    if (!parsed || typeof parsed !== "object") return null
    if (
      parsed.kind !== "M036" &&
      parsed.kind !== "M037" &&
      parsed.kind !== "CERTIFICADO_CENSAL"
    ) {
      return null
    }
    return {
      kind: parsed.kind,
      nif: typeof parsed.nif === "string" ? parsed.nif : null,
      cnae: typeof parsed.cnae === "string" ? parsed.cnae : null,
      corporateTaxCharacter: isCharacter(parsed.corporateTaxCharacter)
        ? parsed.corporateTaxCharacter
        : null,
      siiMode: isSiiMode(parsed.siiMode) ? parsed.siiMode : null,
      cashBasisSubject: typeof parsed.cashBasisSubject === "boolean" ? parsed.cashBasisSubject : null,
    }
  } catch {
    return null
  }
}

export function parseCensusDocumentInput(value: unknown): { fileName: string; reading: CensusReading } | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!value || typeof value !== "object") {
    throw new Error("El contraste del censo no es válido.")
  }
  const input = value as { fileName?: unknown; reading?: unknown }
  const fileName = sanitizeFileName(input.fileName)
  if (!fileName) throw new Error("Falta el nombre del documento censal.")
  if (!input.reading || typeof input.reading !== "object") {
    throw new Error("El contraste del censo no es válido.")
  }
  const reading = input.reading as Partial<CensusReading>
  if (
    reading.kind !== "M036" &&
    reading.kind !== "M037" &&
    reading.kind !== "CERTIFICADO_CENSAL"
  ) {
    throw new Error("El tipo de documento censal no es válido.")
  }
  const nif = typeof reading.nif === "string" ? normalizeTaxId(reading.nif) : ""
  if (!nif || !isValidSpanishTaxId(nif)) {
    throw new Error("El NIF leído en el documento censal no es válido.")
  }
  const cnae = typeof reading.cnae === "string" ? reading.cnae.replace(/\D/g, "") : ""
  return {
    fileName,
    reading: {
      kind: reading.kind,
      nif,
      cnae: cnae.length === 4 ? cnae : null,
      corporateTaxCharacter: isCharacter(reading.corporateTaxCharacter)
        ? reading.corporateTaxCharacter
        : null,
      siiMode: isSiiMode(reading.siiMode) ? reading.siiMode : null,
      cashBasisSubject:
        typeof reading.cashBasisSubject === "boolean" ? reading.cashBasisSubject : null,
    },
  }
}

function compareText(
  field: "cnae",
  label: string,
  profile: string | null,
  document: string,
): CensusContrastRow {
  const profileValue = (profile ?? "").trim()
  return {
    field,
    label,
    profile: profileValue || "Sin indicar",
    document,
    status: !profileValue ? "missing" : profileValue === document ? "match" : "differ",
  }
}

function detectKind(plain: string): CensusDocumentKind {
  if (plain.includes("certificado de situacion censal") || plain.includes("situacion censal")) {
    return "CERTIFICADO_CENSAL"
  }
  if (/modelo\s*037/.test(plain) || plain.includes("declaracion censal simplificada")) {
    return "M037"
  }
  if (/modelo\s*036/.test(plain) || plain.includes("declaracion censal")) {
    return "M036"
  }
  throw new Error(
    "No reconozco un modelo 036, un 037 ni un certificado de situación censal.",
  )
}

function findNif(text: string): string | null {
  const labeled = text.match(
    /(?:N\.?\s*I\.?\s*F\.?|C\.?\s*I\.?\s*F\.?)[:\s]*([A-Z0-9][A-Z0-9\s-]{6,14})/i,
  )
  if (labeled) {
    const candidate = labeled[1].replace(/[^A-Z0-9]/gi, "").slice(0, 9)
    if (isValidSpanishTaxId(candidate)) return candidate
  }
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, " ")
  for (const token of compact.split(/\s+/)) {
    if (token.length === 9 && isValidSpanishTaxId(token)) return token
  }
  return null
}

function findCnae(text: string): string | null {
  const anchor = text.search(/CNAE/i)
  if (anchor < 0) return null
  const window = text.slice(anchor, anchor + 80)
  const codes = window.match(/\d{4}/g) ?? []
  return codes.find((code) => !/^19\d{2}$/.test(code) && !/^20\d{2}$/.test(code)) ?? null
}

function readCharacter(plain: string, kind: CensusDocumentKind): CorporateTaxCharacter | null {
  if (plain.includes("garantia reciproca")) return "GARANTIA_RECIPROCA"
  if (
    plain.includes("inversion colectiva") ||
    plain.includes("institucion de inversion colectiva")
  ) {
    return "INVERSION_COLECTIVA"
  }
  if (/entidad(?:es)? de credito/.test(plain)) return "ENTIDAD_CREDITO"
  if (
    plain.includes("aseguradora") ||
    plain.includes("entidad aseguradora") ||
    plain.includes("compania de seguros")
  ) {
    return "ASEGURADORA"
  }
  if (kind === "CERTIFICADO_CENSAL") {
    if (/impuesto sobre sociedades/.test(plain) || /\bmodelo\s*200\b/.test(plain)) return "SOCIEDAD"
    if (/impuesto sobre la renta|persona fisica/.test(plain)) return "NO_SUJETA"
    return null
  }
  if (obligationMarked(plain, "impuesto sobre sociedades")) return "SOCIEDAD"
  if (kind === "M037") return "NO_SUJETA"
  return null
}

function readSii(plain: string): CompanySiiMode | null {
  const index = Math.max(plain.indexOf("suministro inmediato"), plain.search(/\bsii\b/))
  if (index < 0) return null
  const window = plain.slice(Math.max(0, index - 50), index + 90)
  if (/no inscrito|sin suministro/.test(window)) return "NONE"
  if (/obligatorio/.test(window)) return "OBLIGATORIO"
  if (/voluntario|inscrit/.test(window)) return "VOLUNTARIO"
  return null
}

function readCashBasis(plain: string): boolean | null {
  const index = plain.indexOf("criterio de caja")
  if (index < 0) return null
  const window = plain.slice(Math.max(0, index - 40), index + 60)
  if (/no acogid|sin acog/.test(window)) return false
  if (/acogid/.test(window) || /\balta\b/.test(window)) return true
  return null
}

function obligationMarked(plain: string, label: string): boolean {
  const index = plain.indexOf(label)
  if (index < 0) return false
  const window = plain.slice(index, index + label.length + 70).replace(/fecha de alta/g, "")
  return /\balta\b/.test(window)
}

function stripAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function normalizeTaxId(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase()
}

function yesNo(value: boolean): string {
  return value ? "Sí" : "No"
}

function isCharacter(value: unknown): value is CorporateTaxCharacter {
  return (
    value === "SOCIEDAD" ||
    value === "ENTIDAD_CREDITO" ||
    value === "ASEGURADORA" ||
    value === "INVERSION_COLECTIVA" ||
    value === "GARANTIA_RECIPROCA" ||
    value === "NO_SUJETA"
  )
}

function isSiiMode(value: unknown): value is CompanySiiMode {
  return value === "NONE" || value === "OBLIGATORIO" || value === "VOLUNTARIO"
}

function sanitizeFileName(value: unknown): string {
  if (typeof value !== "string") return ""
  const base = value.split(/[/\\]/).pop()?.trim() ?? ""
  return base.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, "").slice(0, 180)
}
