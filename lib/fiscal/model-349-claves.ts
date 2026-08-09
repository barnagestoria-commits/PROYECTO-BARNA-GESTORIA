/**
 * Claves de operación del modelo 349 (AEAT, ejercicios 2020+).
 * @see https://www3.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2024/capitulo-09-declaraciones-informativas-iva-379/declaracion-recapitulativa-operac-intracomunitarias-modelo-349/contenido-modelo-349.html
 */

export type Model349Clave = "A" | "C" | "D" | "E" | "H" | "I" | "M" | "R" | "S" | "T"

export const MODEL_349_CLAVE_LABELS: Record<Model349Clave, string> = {
  A: "Adquisiciones intracomunitarias de bienes",
  E: "Entregas intracomunitarias de bienes",
  S: "Prestaciones intracomunitarias de servicios",
  I: "Adquisiciones intracomunitarias de servicios",
  T: "Operaciones triangulares",
  M: "Entregas post importación exenta",
  H: "Entregas post importación exenta (repr. fiscal)",
  R: "Transferencias en consigna",
  D: "Devoluciones en consigna",
  C: "Sustituciones en consigna",
}

export const MODEL_349_CLAVE_ORDER: Model349Clave[] = [
  "E",
  "A",
  "S",
  "I",
  "T",
  "M",
  "H",
  "R",
  "D",
  "C",
]

import { extractPrimaryEuVatId } from "@/lib/fiscal/eu-vat-id"

const KNOWN_EU_SERVICE_PROVIDER_PATTERNS = [
  /GOOGLE\s+IRELAND/i,
  /AMAZON\s+(EU|SERVICES|WEBSERVICES|ONLINE)/i,
  /META\s+PLATFORMS\s+IRELAND/i,
  /MICROSOFT\s+IRELAND/i,
  /LINKEDIN\s+IRELAND/i,
  /STRIPE\s+PAYMENTS/i,
  /SHOPIFY\s+INTERNATIONAL/i,
  /ADOBE\s+SYSTEMS\s+SOFTWARE/i,
  /SPOTIFY\s+AB/i,
  /CANVA/i,
  /HUBSPOT/i,
  /SALESFORCE/i,
  /ZOOM\s+VIDEO/i,
  /DROPBOX/i,
  /SLACK\s+TECHNOLOGIES/i,
  /ATLASSIAN/i,
  /NOTION\s+LABS/i,
  /FIGMA/i,
]

export interface Model349ClaveInput {
  concepto: string
  entryConcept?: string | null
  cuenta: string
  debe: number
  haber: number
}

function normalizeCuenta(cuenta: string): string {
  return cuenta.replace(/\D/g, "")
}

function combinedText(input: Model349ClaveInput): string {
  return `${input.concepto} ${input.entryConcept ?? ""}`.trim()
}

function hasEuVatNumber(text: string): boolean {
  return extractPrimaryEuVatId(text) !== null
}

function isKnownEuServiceProvider(text: string): boolean {
  return KNOWN_EU_SERVICE_PROVIDER_PATTERNS.some((pattern) => pattern.test(text))
}

function isServiceContext(text: string): boolean {
  if (/SERVICIO|SERVICE|PRESTAC|CONSULT/i.test(text)) return true
  if (/SOFTWARE|SAAS|HOSTING|CLOUD|LICENCIA|ROYALT/i.test(text)) return true
  if (/PUBLICIDAD|ADWORDS|\bADS\b|SUBSCRIPTION|SUSCRIPC/i.test(text)) return true
  if (/PERITAC|AUDITOR|ABOGAD|NOTAR|FORMACI|MARKETING|DISEÑO|DESIGN/i.test(text)) return true
  return isKnownEuServiceProvider(text)
}

function isPurchaseSide(input: Model349ClaveInput, text: string): boolean {
  if (/^IVA\s+S\./i.test(input.concepto.trim())) return true
  if (/ADQ\.?\s*INTRA|ADQUISIC/i.test(text)) return true

  const cuenta = normalizeCuenta(input.cuenta)
  if (cuenta.startsWith("472") || cuenta.startsWith("600") || cuenta.startsWith("620")) {
    return input.debe >= input.haber
  }
  return input.debe > input.haber
}

function isSalesSide(input: Model349ClaveInput, text: string): boolean {
  if (/^IVA\s+R\./i.test(input.concepto.trim())) return true
  if (/ENTREGA\s*INTRA|VENTA\s*INTRA|EXPEDIC/i.test(text)) return true

  const cuenta = normalizeCuenta(input.cuenta)
  if (cuenta.startsWith("477") || cuenta.startsWith("700") || cuenta.startsWith("705")) {
    return input.haber >= input.debe
  }
  return input.haber > input.debe
}

function explicitClaveInText(text: string): Model349Clave | null {
  const match =
    text.match(/\b(?:CLAVE|MOD\.?|MODELO)\s*349\s*[:\-]?\s*([ACDEHIMRST])\b/i) ??
    text.match(/\b349\s*[:\-]\s*([ACDEHIMRST])\b/i)
  if (!match) return null
  const clave = match[1].toUpperCase() as Model349Clave
  return MODEL_349_CLAVE_LABELS[clave] ? clave : null
}

function vatOperationCodeClave(text: string): Model349Clave | null {
  if (/\b(?:TIPO\s+OP\.?|OPER\.?)\s*3\b/i.test(text)) return "A"
  if (/\b(?:TIPO\s+OP\.?|OPER\.?)\s*7\b/i.test(text)) return "I"
  return null
}

export function detectModel349Clave(input: Model349ClaveInput): Model349Clave {
  const text = combinedText(input)
  const upper = text.toUpperCase()

  const explicit = explicitClaveInText(text)
  if (explicit) return explicit

  const vatOp = vatOperationCodeClave(text)
  if (vatOp) return vatOp

  if (/TRIANGUL|TRIANGULAR|\bOP\.?\s*TRI\b/i.test(text)) return "T"

  if (/DEVOLUC/i.test(text) && /CONSIGN/i.test(text)) return "D"
  if (/SUSTITUC/i.test(text) && /CONSIGN/i.test(text)) return "C"
  if (/TRANSFER/i.test(text) && /CONSIGN/i.test(text)) return "R"

  if (/IMPORT/i.test(text) && /EXENT|ART\.?\s*27/i.test(text)) {
    return /REPRESENTANTE\s+FISCAL|REPR\.?\s+FISC|CLAVE\s*H/i.test(text) ? "H" : "M"
  }

  if (/ADQ\.?\s*INTRA|ADQUISIC/i.test(text)) {
    return isServiceContext(text) ? "I" : "A"
  }

  if (/ENTREGA\s*INTRA|VENTA\s*INTRA|EXPEDIC/i.test(text)) {
    return isServiceContext(text) ? "S" : "E"
  }

  const services = isServiceContext(text) || (hasEuVatNumber(text) && isKnownEuServiceProvider(text))

  if (isPurchaseSide(input, upper)) {
    return services ? "I" : "A"
  }

  if (isSalesSide(input, upper)) {
    return services ? "S" : "E"
  }

  return services ? "I" : "A"
}

export function formatModel349Clave(clave: Model349Clave): string {
  return `${clave} — ${MODEL_349_CLAVE_LABELS[clave]}`
}

export function isModel349Clave(value: string): value is Model349Clave {
  return value in MODEL_349_CLAVE_LABELS
}

export function model349SectionKeyForClave(clave: Model349Clave): string {
  return `clave-${clave}`
}

export function parseModel349SectionKey(sectionKey: string): Model349Clave | null {
  if (!sectionKey.startsWith("clave-")) return null
  const clave = sectionKey.slice(6).toUpperCase()
  return isModel349Clave(clave) ? clave : null
}
