import type { InvoiceOcrResult, IvaDesgloseLine, RecargoEquivalencia, TipoIva } from "@/lib/types/invoice"
import { normalizeTaxId } from "@/lib/tax-id"
import {
  calculateCuotaIva,
  createEmptyDesgloseLine,
  parseTipoIva,
  round2,
  syncInvoiceTotals,
} from "@/lib/invoice-totals"

const SUJETO_PASIVO_PATTERNS = [
  /inversi[oó]n\s+del\s+sujeto\s+pasivo/i,
  /inversion\s+del\s+sujeto\s+pasivo/i,
  /art[ií]culo\s+84\.?\s*uno\.?\s*2/i,
  /art\.?\s*84\.?\s*uno\.?\s*2/i,
  /art[ií]culo\s+84[^\n]{0,40}2\s*[º°o]/i,
  /reverse\s+charge/i,
  /autoliquidaci[oó]n\s+del\s+iva/i,
]

const INTRACOMUNITARIA_PATTERNS = [
  /intracomunitari[oa]/i,
  /intra-comunitari[oa]/i,
  /intra\s+comunitari[oa]/i,
  /operaci[oó]n\s+intracomunitaria/i,
  /adquisici[oó]n\s+intracomunitaria/i,
  /entrega\s+intracomunitaria/i,
  /exento\s+de\s+iva/i,
  /iva\s+0\s*%/i,
  /0\s*%\s*iva/i,
  /not\s+subject\s+to\s+vat/i,
  /reverse\s+charge/i,
]

const RECARGO_PATTERNS = [
  /recargo\s+de\s+equivalencia/i,
  /recargo\s+equivalencia/i,
  /r\.?\s*eq\.?/i,
]

const KNOWN_INTRACOMUNITARIA_PROVIDERS = [
  /google\s+ireland/i,
  /amazon\s+(eu|services|webservices|online)/i,
  /meta\s+platforms\s+ireland/i,
  /microsoft\s+ireland/i,
  /linkedin\s+ireland/i,
  /stripe\s+payments/i,
  /shopify\s+international/i,
  /adobe\s+systems\s+software/i,
]

const EU_COUNTRY_VAT_PREFIXES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "FI", "FR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT",
  "RO", "SE", "SI", "SK", "XI",
]

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

export function detectSujetoPasivoFromText(text: string): boolean {
  return SUJETO_PASIVO_PATTERNS.some((pattern) => pattern.test(normalizeText(text)))
}

function hasEuVatNumber(text: string): boolean {
  const matches = text.match(/\b([A-Z]{2})[\s-]?[A-Z0-9]{8,12}\b/gi) ?? []
  return matches.some((match) => {
    const prefix = match.replace(/[\s-]/g, "").slice(0, 2).toUpperCase()
    return EU_COUNTRY_VAT_PREFIXES.includes(prefix) && prefix !== "ES"
  })
}

function isKnownIntracomunitariaProvider(proveedor: string): boolean {
  return KNOWN_INTRACOMUNITARIA_PROVIDERS.some((pattern) => pattern.test(proveedor))
}

export function detectIntracomunitariaFromText(
  text: string,
  proveedor: string,
  iva: number,
): boolean {
  const normalized = normalizeText(text)
  const providerNormalized = normalizeText(proveedor)
  const keywordMatch = INTRACOMUNITARIA_PATTERNS.some((pattern) => pattern.test(normalized))
  const providerMatch = isKnownIntracomunitariaProvider(providerNormalized)
  const euVatMatch = hasEuVatNumber(text) || hasEuVatNumber(proveedor)
  const zeroVatMatch = iva === 0

  return (keywordMatch || providerMatch || (euVatMatch && zeroVatMatch)) && zeroVatMatch
}

export function detectRecargoFromText(text: string): boolean {
  return RECARGO_PATTERNS.some((pattern) => pattern.test(normalizeText(text)))
}

export function parseBooleanField(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "sí"
  }
  if (typeof value === "number") return value === 1
  return false
}

export function applyFiscalAmountRules(result: InvoiceOcrResult): InvoiceOcrResult {
  return syncInvoiceTotals(result)
}

export function applyFiscalRules(raw: InvoiceOcrResult, sourceText?: string): InvoiceOcrResult {
  let result = { ...raw, cif: normalizeTaxId(raw.cif) }

  if (sourceText) {
    result.isSujetoPasivo = result.isSujetoPasivo || detectSujetoPasivoFromText(sourceText)
    result.isIntracomunitaria =
      result.isIntracomunitaria ||
      detectIntracomunitariaFromText(sourceText, result.proveedor, result.iva)

    if (!result.recargo_equivalencia && detectRecargoFromText(sourceText)) {
      result.recargo_equivalencia = { porcentaje: 0, cuota: 0 }
    }
  }

  return applyFiscalAmountRules(result)
}

export function parseDesgloseLine(raw: unknown): IvaDesgloseLine | null {
  if (!raw || typeof raw !== "object") return null

  const line = raw as Record<string, unknown>
  const base = round2(parseAmount(line.base_imponible ?? line.baseImponible))
  const tipo = parseTipoIva(line.tipo_iva ?? line.tipoIva)
  const cuota = round2(parseAmount(line.cuota_iva ?? line.cuotaIva ?? calculateCuotaIva(base, tipo)))

  return { base_imponible: base, tipo_iva: tipo, cuota_iva: cuota }
}

export function parseRecargoEquivalencia(raw: unknown): RecargoEquivalencia | null {
  if (!raw || typeof raw !== "object") return null

  const recargo = raw as Record<string, unknown>
  const porcentaje = round2(parseAmount(recargo.porcentaje ?? recargo.porcentaje_recargo))
  const cuota = round2(parseAmount(recargo.cuota ?? recargo.cuota_recargo))

  if (porcentaje === 0 && cuota === 0) return null

  return { porcentaje, cuota }
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return round2(value)
  }

  if (typeof value === "string") {
    const normalized = value
      .replace(/[€\s%]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".")
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? round2(parsed) : 0
  }

  return 0
}

export function buildDesgloseFromLegacy(
  baseImponible: number,
  iva: number,
  tipoIva: TipoIva = 21,
): IvaDesgloseLine[] {
  if (baseImponible === 0 && iva === 0) {
    return [createEmptyDesgloseLine()]
  }

  return [
    {
      base_imponible: baseImponible,
      tipo_iva: tipoIva,
      cuota_iva: iva,
    },
  ]
}
