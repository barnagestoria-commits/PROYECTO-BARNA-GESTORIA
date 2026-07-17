import OpenAI from "openai"
import type { InvoiceOcrResult, TipoIva } from "@/lib/types/invoice"
import { OcrConfigError, OcrExtractionError } from "@/lib/ocr/errors"
import {
  applyFiscalRules,
  buildDesgloseFromLegacy,
  parseBooleanField,
  parseDesgloseLine,
  parseRecargoEquivalencia,
} from "@/lib/ocr/fiscal-rules"
import { round2, syncInvoiceTotals } from "@/lib/invoice-totals"
import { normalizeTaxId } from "@/lib/tax-id"

const DEEPSEEK_BASE_URL = "https://api.deepseek.com"

const EXTRACTION_PROMPT = `Eres un asistente experto en contabilidad y normativa fiscal española (IVA, LIVA, recargo de equivalencia). Analiza esta factura recibida y extrae los datos del PROVEEDOR/EMISOR (no del cliente/receptor).

Reglas generales:
- Devuelve importes numéricos en euros (sin símbolo €).
- Normaliza el CIF/NIF/VAT del proveedor en mayúsculas, sin espacios ni guiones.
- La fecha debe estar en formato YYYY-MM-DD.
- Prioriza datos del emisor/proveedor, no del destinatario.

DESGLOSE DE IVA (iva_desglose):
- Devuelve un ARRAY con una línea por cada tipo de IVA distinto que aparezca en la factura.
- Cada línea debe tener: base_imponible (número), tipo_iva (21, 10, 4 u 0), cuota_iva (número).
- Si la factura tiene varios tipos (p. ej. 21% y 10%), crea varias líneas.
- Si solo hay un tipo, devuelve un array con un único elemento.
- tipo_iva solo puede ser: 21, 10, 4 o 0.
- La suma de base_imponible de todas las líneas = baseImponible total.
- La suma de cuota_iva de todas las líneas = iva total.

RECARGO DE EQUIVALENCIA (recargo_equivalencia):
- Si la factura incluye recargo de equivalencia (comerciantes minoristas), extrae:
  recargo_equivalencia: { "porcentaje": número, "cuota": número }
- Porcentajes habituales en España: 5.2% (sobre base al 21%), 1.4% (sobre base al 10%), 0.5% (sobre base al 4%).
- Si NO hay recargo, devuelve recargo_equivalencia: null.

TOTAL:
- total = suma de todas las base_imponible + suma de todas las cuota_iva + cuota del recargo (si existe).
- baseImponible e iva son los totales agregados del desglose.

Normativa fiscal especial:
1) isIntracomunitaria = true: proveedor UE, VAT no ES, IVA 0% o exento.
2) isSujetoPasivo = true: mención "inversión del sujeto pasivo" o "artículo 84.Uno.2º". En ese caso cuota_iva = 0 en todas las líneas y recargo_equivalencia = null.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown) con estas claves:
proveedor, cif, numeroFactura, fechaFactura, iva_desglose, recargo_equivalencia, baseImponible, iva, total, isIntracomunitaria, isSujetoPasivo

Ejemplo de iva_desglose:
[
  { "base_imponible": 100.00, "tipo_iva": 21, "cuota_iva": 21.00 },
  { "base_imponible": 50.00, "tipo_iva": 10, "cuota_iva": 5.00 }
]`

function getApiKey(): string {
  return (
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ""
  )
}

function getInvoiceModel(): string {
  return (
    process.env.DEEPSEEK_INVOICE_MODEL?.trim() ||
    process.env.OPENAI_INVOICE_MODEL?.trim() ||
    "deepseek-chat"
  )
}

function getDeepSeekClient(): OpenAI {
  const apiKey = getApiKey()

  if (!apiKey) {
    throw new OcrConfigError(
      "DEEPSEEK_API_KEY no está configurada. Crea un archivo .env.local con tu clave de DeepSeek.",
    )
  }

  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  })
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

function normalizeDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return ""
  }

  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) {
    const [, day, month, year] = dmy
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0]
  }

  return trimmed
}

function parseIvaDesglose(raw: unknown, baseImponible: number, iva: number): InvoiceOcrResult["iva_desglose"] {
  if (Array.isArray(raw) && raw.length > 0) {
    const lines = raw.map(parseDesgloseLine).filter((line): line is NonNullable<typeof line> => line !== null)
    if (lines.length > 0) return lines
  }

  const inferredTipo: TipoIva = iva === 0 ? 0 : 21
  return buildDesgloseFromLegacy(baseImponible, iva, inferredTipo)
}

function normalizeInvoiceResult(raw: Record<string, unknown>): InvoiceOcrResult {
  const baseImponible = parseAmount(raw.baseImponible)
  const iva = parseAmount(raw.iva)
  const total = parseAmount(raw.total)
  const iva_desglose = parseIvaDesglose(raw.iva_desglose, baseImponible, iva)
  const recargo_equivalencia = parseRecargoEquivalencia(raw.recargo_equivalencia)

  const result: InvoiceOcrResult = {
    proveedor: typeof raw.proveedor === "string" ? raw.proveedor.trim() : "",
    cif: typeof raw.cif === "string" ? normalizeTaxId(raw.cif) : "",
    numeroFactura: typeof raw.numeroFactura === "string" ? raw.numeroFactura.trim() : "",
    fechaFactura: normalizeDate(raw.fechaFactura),
    iva_desglose,
    recargo_equivalencia,
    baseImponible,
    iva,
    total: total || round2(baseImponible + iva + (recargo_equivalencia?.cuota ?? 0)),
    isIntracomunitaria: parseBooleanField(raw.isIntracomunitaria),
    isSujetoPasivo: parseBooleanField(raw.isSujetoPasivo),
  }

  return syncInvoiceTotals(result)
}

function parseModelResponse(content: string | null | undefined): InvoiceOcrResult {
  if (!content?.trim()) {
    throw new OcrExtractionError("DeepSeek no devolvió datos de la factura.")
  }

  let parsed: unknown

  try {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
    parsed = JSON.parse(cleaned)
  } catch {
    throw new OcrExtractionError("La respuesta de DeepSeek no tiene un formato JSON válido.")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new OcrExtractionError("La respuesta de DeepSeek no contiene un objeto de factura.")
  }

  return normalizeInvoiceResult(parsed as Record<string, unknown>)
}

async function requestStructuredExtraction(documentText: string): Promise<InvoiceOcrResult> {
  const client = getDeepSeekClient()
  const model = getInvoiceModel()

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: documentText },
      ],
      response_format: { type: "json_object" },
    })

    const raw = parseModelResponse(response.choices[0]?.message?.content)
    const sourceText = documentText.replace(/^Texto extraído del PDF:\n\n/i, "")
    return applyFiscalRules(raw, sourceText)
  } catch (error) {
    if (error instanceof OcrConfigError || error instanceof OcrExtractionError) {
      throw error
    }

    const message = error instanceof Error ? error.message : "Error desconocido"
    throw new OcrExtractionError(`Error al analizar la factura con DeepSeek: ${message}`)
  }
}

export async function extractInvoiceFromText(text: string): Promise<InvoiceOcrResult> {
  return requestStructuredExtraction(`Texto extraído del PDF:\n\n${text}`)
}
