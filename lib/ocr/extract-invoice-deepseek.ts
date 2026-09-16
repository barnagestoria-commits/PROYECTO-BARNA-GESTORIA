import OpenAI from "openai"
import type { ChatCompletionContentPart } from "openai/resources/chat/completions"
import type { InvoiceOcrResult, TipoIva } from "@/lib/types/invoice"
import { parsePurchaseNature } from "@/lib/accounting/invoice-supplier-classification"
import { OcrConfigError, OcrExtractionError } from "@/lib/ocr/errors"
import { chunkPages, mergeExtractedInvoices } from "@/lib/ocr/invoice-page-batch"
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

const SHARED_JSON_FIELDS = `"iva_desglose": [{ "base_imponible": 0, "tipo_iva": 21, "cuota_iva": 0 }],
      "recargo_equivalencia": null,
      "baseImponible": 0,
      "iva": 0,
      "total": 0,
      "isIntracomunitaria": false,
      "isSujetoPasivo": false,
      "pagina": 1,
      "paginaFin": 1`

const PURCHASE_EXTRACTION_PROMPT = `Eres un asistente experto en contabilidad y normativa fiscal española (IVA, LIVA, recargo de equivalencia). Analiza el documento (texto y/o fotos de tickets y facturas) y extrae los datos de CADA factura o ticket recibido. El proveedor/emisor es quien emite el documento, no el cliente/receptor.

Reglas generales:
- Devuelve importes numéricos en euros (sin símbolo €).
- Normaliza el CIF/NIF/VAT del proveedor en mayúsculas, sin espacios ni guiones.
- La fecha debe estar en formato YYYY-MM-DD.
- Prioriza datos del emisor/proveedor, no del destinatario.
- Si hay VARIAS facturas o tickets (gasolina, parking, taller, supermercado, etc.), devuelve una entrada por cada uno. No las fusiones.
- Si un ticket no trae NIF, deja cif vacío pero rellena proveedor, fecha, importes y tipo de IVA si se ven.
- pagina y paginaFin son páginas del PDF (empezando en 1) de ESA factura. Si ocupa una sola página, pagina = paginaFin.
- Cada imagen va precedida por su número real «PÁGINA PDF N». Usa SIEMPRE ese número absoluto; no vuelvas a numerar las imágenes desde 1.

DESGLOSE DE IVA (iva_desglose):
- Devuelve un ARRAY con una línea por cada tipo de IVA distinto.
- Cada línea: base_imponible (número), tipo_iva (21, 10, 4 u 0), cuota_iva (número).
- tipo_iva solo puede ser: 21, 10, 4 o 0.
- Si el ticket solo muestra el total, estima la base y la cuota con el tipo indicado (habitualmente 21%).

RECARGO DE EQUIVALENCIA (recargo_equivalencia):
- Si aparece, extrae { "porcentaje": número, "cuota": número }. Si no hay, null.

TOTAL:
- total = bases + cuotas IVA + recargo.

Normativa fiscal especial:
1) isIntracomunitaria = true: proveedor UE, VAT no ES, IVA 0% o exento.
2) isSujetoPasivo = true: "inversión del sujeto pasivo" o "artículo 84.Uno.2º". Entonces cuota_iva = 0 y recargo_equivalencia = null.

NATURALEZA DE LA COMPRA (naturalezaCompra), según lo que compra el receptor, no el nombre comercial:
- "suministros": combustible, estación de servicio, luz, gas, agua.
- "reparaciones": taller, recambios, filtros, mantenimiento del vehículo u otro inmovilizado propio.
- "servicios": parking, peaje, telefonía, profesionales, seguros, alquiler, software.
- "mercaderias": solo si son existencias o materia prima para revender.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown):
{
  "invoices": [
    {
      "proveedor": "",
      "cif": "",
      "numeroFactura": "",
      "fechaFactura": "YYYY-MM-DD",
      ${SHARED_JSON_FIELDS},
      "naturalezaCompra": "servicios"
    }
  ]
}`

const SALES_EXTRACTION_PROMPT = `Eres un asistente experto en contabilidad y normativa fiscal española. Analiza facturas EMITIDAS (ventas). El tercero es el CLIENTE / destinatario, NO el emisor. No uses el nombre ni el NIF de quien emite el documento.

Reglas generales:
- Devuelve importes numéricos en euros (sin símbolo €).
- En "proveedor" pon la razón social del cliente/receptor. En "cif" el NIF/CIF/VAT del cliente.
- Normaliza el CIF/NIF/VAT en mayúsculas, sin espacios ni guiones.
- La fecha debe estar en formato YYYY-MM-DD.
- Si hay VARIAS facturas, una entrada por cada una. No las fusiones.
- pagina y paginaFin son páginas del PDF (empezando en 1) de ESA factura. Si ocupa una sola página, pagina = paginaFin.
- Cada imagen va precedida por su número real «PÁGINA PDF N». Usa SIEMPRE ese número absoluto; no vuelvas a numerar las imágenes desde 1.

DESGLOSE DE IVA, recargo, total e isIntracomunitaria / isSujetoPasivo: mismas reglas que en una factura española.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown):
{
  "invoices": [
    {
      "proveedor": "",
      "cif": "",
      "numeroFactura": "",
      "fechaFactura": "YYYY-MM-DD",
      ${SHARED_JSON_FIELDS}
    }
  ]
}`

function getApiKey(): string {
  return process.env.DEEPSEEK_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || ""
}

function getTextModel(): string {
  return (
    process.env.DEEPSEEK_INVOICE_MODEL?.trim() ||
    process.env.OPENAI_INVOICE_MODEL?.trim() ||
    "deepseek-chat"
  )
}

function getVisionModel(): string {
  return process.env.DEEPSEEK_VISION_MODEL?.trim() || "deepseek-flash"
}

function getDeepSeekClient(): OpenAI {
  const apiKey = getApiKey()

  if (!apiKey) {
    throw new OcrConfigError(
      "DEEPSEEK_API_KEY no está configurada. Configura el servicio de análisis de facturas en el entorno.",
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

function stringField(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
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

function parsePageNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseFloat(value.trim())
        : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return Math.trunc(parsed)
}

function parseIvaDesglose(raw: unknown, baseImponible: number, iva: number): InvoiceOcrResult["iva_desglose"] {
  if (Array.isArray(raw) && raw.length > 0) {
    const lines = raw.map(parseDesgloseLine).filter((line): line is NonNullable<typeof line> => line !== null)
    if (lines.length > 0) return lines
  }

  const inferredTipo: TipoIva = iva === 0 ? 0 : 21
  return buildDesgloseFromLegacy(baseImponible, iva, inferredTipo)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function hasMeaningfulInvoice(result: InvoiceOcrResult): boolean {
  return Boolean(
    result.proveedor.trim() ||
      result.cif.trim() ||
      result.numeroFactura.trim() ||
      result.total > 0 ||
      result.baseImponible > 0,
  )
}

function normalizeInvoiceResult(raw: Record<string, unknown>): InvoiceOcrResult {
  const baseImponible = parseAmount(raw.baseImponible ?? raw.base_imponible)
  const iva = parseAmount(raw.iva ?? raw.cuotaIva ?? raw.cuota_iva)
  const total = parseAmount(raw.total)
  const iva_desglose = parseIvaDesglose(raw.iva_desglose ?? raw.ivaDesglose, baseImponible, iva)
  const recargo_equivalencia = parseRecargoEquivalencia(raw.recargo_equivalencia ?? raw.recargoEquivalencia)

  const result: InvoiceOcrResult = {
    proveedor: stringField(raw.proveedor, raw.razonSocial, raw.razon_social, raw.emisor),
    cif: normalizeTaxId(stringField(raw.cif, raw.nif, raw.vat, raw.nifCif)),
    numeroFactura: stringField(raw.numeroFactura, raw.numero_factura, raw.numFactura, raw.ticket),
    fechaFactura: normalizeDate(raw.fechaFactura ?? raw.fecha_factura ?? raw.fecha),
    iva_desglose,
    recargo_equivalencia,
    baseImponible,
    iva,
    total: total || round2(baseImponible + iva + (recargo_equivalencia?.cuota ?? 0)),
    isIntracomunitaria: parseBooleanField(raw.isIntracomunitaria ?? raw.intracomunitaria),
    isSujetoPasivo: parseBooleanField(raw.isSujetoPasivo ?? raw.sujetoPasivo),
    naturalezaCompra: parsePurchaseNature(raw.naturalezaCompra ?? raw.naturaleza_compra ?? raw.naturaleza),
  }

  const pagina = parsePageNumber(raw.pagina ?? raw.pageStart ?? raw.page ?? raw.paginaInicio)
  const paginaFin = parsePageNumber(raw.paginaFin ?? raw.pageEnd ?? raw.pagina_fin ?? raw.paginaFinal)
  if (pagina) result.pagina = pagina
  if (paginaFin || pagina) result.paginaFin = paginaFin && pagina ? Math.max(pagina, paginaFin) : paginaFin ?? pagina

  return syncInvoiceTotals(result)
}

function collectInvoiceRecords(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord)
  }

  if (!isRecord(parsed)) return []

  const nested = parsed.invoices ?? parsed.facturas ?? parsed.data ?? parsed.results ?? parsed.factura
  if (Array.isArray(nested)) {
    return nested.filter(isRecord)
  }
  if (isRecord(nested)) {
    return [nested]
  }

  return [parsed]
}

export function parseInvoiceModelResponse(content: string | null | undefined): InvoiceOcrResult[] {
  if (!content?.trim()) {
    throw new OcrExtractionError("El servicio de análisis no devolvió datos de la factura.")
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
    throw new OcrExtractionError("La respuesta del análisis no tiene un formato JSON válido.")
  }

  const invoices = collectInvoiceRecords(parsed)
    .map(normalizeInvoiceResult)
    .filter(hasMeaningfulInvoice)

  if (invoices.length === 0) {
    throw new OcrExtractionError(
      "No se reconoció ninguna factura o ticket en el documento. Prueba con un PDF más nítido o sube cada factura por separado.",
    )
  }

  return invoices
}

function buildUserContent(
  documentText: string,
  imageDataUrls: string[],
  pageNumbers: number[] = [],
): string | ChatCompletionContentPart[] {
  const text =
    documentText.trim() ||
    "El PDF no tenía texto seleccionable. Extrae cada factura o ticket visible en las imágenes."

  if (imageDataUrls.length === 0) {
    return text
  }

  const content: ChatCompletionContentPart[] = [{ type: "text", text }]
  imageDataUrls.forEach((url, index) => {
    const pageNumber = pageNumbers[index] ?? index + 1
    content.push({ type: "text", text: `PÁGINA PDF ${pageNumber}` })
    content.push({
      type: "image_url",
      image_url: { url, detail: "high" },
    })
  })
  return content
}

export function alignInvoicePages(
  invoices: InvoiceOcrResult[],
  pageNumbers: number[],
): InvoiceOcrResult[] {
  if (pageNumbers.length === 0) return invoices

  const firstPage = pageNumbers[0]!
  const lastPage = pageNumbers[pageNumbers.length - 1]!
  const localPageCount = pageNumbers.length
  const oneInvoicePerPage = invoices.length === pageNumbers.length

  return invoices.map((invoice, index) => {
    if (oneInvoicePerPage) {
      const page = pageNumbers[index]!
      return { ...invoice, pagina: page, paginaFin: page }
    }

    const reportedStart = invoice.pagina
    const reportedEnd = invoice.paginaFin ?? reportedStart
    let pageStart = reportedStart
    let pageEnd = reportedEnd

    if (
      firstPage > 1 &&
      reportedStart !== undefined &&
      reportedStart >= 1 &&
      reportedStart <= localPageCount
    ) {
      pageStart = firstPage + reportedStart - 1
    }
    if (
      firstPage > 1 &&
      reportedEnd !== undefined &&
      reportedEnd >= 1 &&
      reportedEnd <= localPageCount
    ) {
      pageEnd = firstPage + reportedEnd - 1
    }

    if (pageStart === undefined || pageStart < firstPage || pageStart > lastPage) {
      pageStart = pageNumbers[Math.min(index, pageNumbers.length - 1)]!
    }
    if (pageEnd === undefined || pageEnd < pageStart || pageEnd > lastPage) {
      pageEnd = pageStart
    }

    return { ...invoice, pagina: pageStart, paginaFin: pageEnd }
  })
}

function isEmptyInvoiceRecognitionError(error: unknown): boolean {
  return (
    error instanceof OcrExtractionError &&
    /no se reconoció ninguna factura/i.test(error.message)
  )
}

async function requestStructuredExtraction(
  documentText: string,
  imageDataUrls: string[],
  options?: {
    allowEmpty?: boolean
    documentType?: "factura-recibida" | "factura-emitida"
    pageNumbers?: number[]
  },
): Promise<InvoiceOcrResult[]> {
  const client = getDeepSeekClient()
  const model = imageDataUrls.length > 0 ? getVisionModel() : getTextModel()
  const prompt =
    options?.documentType === "factura-emitida" ? SALES_EXTRACTION_PROMPT : PURCHASE_EXTRACTION_PROMPT

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: buildUserContent(documentText, imageDataUrls, options?.pageNumbers),
        },
      ],
      response_format: { type: "json_object" },
    })

    const invoices = parseInvoiceModelResponse(response.choices[0]?.message?.content)
    const sourceText = documentText.replace(/^Texto extraído del PDF:\n\n/i, "")
    const aligned = alignInvoicePages(invoices, options?.pageNumbers ?? [])
    return aligned.map((invoice) => applyFiscalRules(invoice, sourceText))
  } catch (error) {
    if (options?.allowEmpty && isEmptyInvoiceRecognitionError(error)) {
      return []
    }
    if (error instanceof OcrConfigError || error instanceof OcrExtractionError) {
      throw error
    }

    const message = error instanceof Error ? error.message : "Error desconocido"
    throw new OcrExtractionError(`Error al analizar la factura: ${message}`)
  }
}

function isLikelyVisionUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  return /image|vision|multimodal|invalid model|does not support|unknown model/i.test(message)
}

export async function extractInvoicesFromDocument(input: {
  text?: string
  pageTexts?: string[]
  imageDataUrls?: string[]
  documentType?: "factura-recibida" | "factura-emitida"
}): Promise<InvoiceOcrResult[]> {
  const text = input.text?.trim() ?? ""
  const imageDataUrls = input.imageDataUrls?.filter(Boolean) ?? []

  if (!text && imageDataUrls.length === 0) {
    throw new OcrExtractionError(
      "No se pudo leer el documento. Sube un PDF o una foto nítida de la factura o ticket.",
    )
  }

  const prefixedText = text ? `Texto extraído del PDF:\n\n${text}` : ""
  const pageTexts = input.pageTexts ?? []
  const imagePages = imageDataUrls.map((url, index) => ({
    url,
    pageNumber: index + 1,
    text: pageTexts[index] ?? "",
  }))
  const pageChunks = chunkPages(imagePages)
  const documentType = input.documentType

  try {
    if (pageChunks.length <= 1) {
      const pages = pageChunks[0] ?? []
      const chunkText =
        pages.length > 0
          ? pages
              .map(
                (page) =>
                  `PÁGINA PDF ${page.pageNumber}\n${page.text || "(sin texto seleccionable)"}`,
              )
              .join("\n\n")
          : prefixedText
      return await requestStructuredExtraction(
        chunkText,
        pages.map((page) => page.url),
        {
          documentType,
          pageNumbers: pages.map((page) => page.pageNumber),
        },
      )
    }

    const batches: InvoiceOcrResult[][] = []
    for (const chunk of pageChunks) {
      const chunkText = [
        "Extrae SOLO las facturas o tickets de las páginas indicadas a continuación.",
        ...chunk.map(
          (page) =>
            `PÁGINA PDF ${page.pageNumber}\n${page.text || "(sin texto seleccionable)"}`,
        ),
      ].join("\n\n")
      const batch = await requestStructuredExtraction(
        chunkText,
        chunk.map((page) => page.url),
        {
          allowEmpty: true,
          documentType,
          pageNumbers: chunk.map((page) => page.pageNumber),
        },
      )
      batches.push(batch)
    }

    const merged = mergeExtractedInvoices(batches)
    if (merged.length === 0) {
      throw new OcrExtractionError(
        "No se reconoció ninguna factura o ticket en el documento. Prueba con un PDF más nítido o sube cada factura por separado.",
      )
    }
    return merged
  } catch (error) {
    if (
      imageDataUrls.length > 0 &&
      text.replace(/\s+/g, " ").trim().length >= 80 &&
      isLikelyVisionUnsupported(error)
    ) {
      const pageLabeledText =
        pageTexts.length > 0
          ? pageTexts
              .map((pageText, index) => `PÁGINA PDF ${index + 1}\n${pageText}`)
              .join("\n\n")
          : prefixedText
      return requestStructuredExtraction(pageLabeledText, [], { documentType })
    }
    throw error
  }
}

export async function extractInvoiceFromText(text: string): Promise<InvoiceOcrResult> {
  const invoices = await extractInvoicesFromDocument({ text })
  return invoices[0]
}
