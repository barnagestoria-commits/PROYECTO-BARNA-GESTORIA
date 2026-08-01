import OpenAI from "openai"
import type { BankMovementDraft, BankImportPreview } from "@/lib/bank-reconciliation/types"
import { OcrConfigError, OcrExtractionError } from "@/lib/ocr/errors"
import { extractTextFromPdf, hasUsableExtractedText } from "@/lib/ocr/extract-pdf-text"

const DEEPSEEK_BASE_URL = "https://api.deepseek.com"

const EXTRACTION_PROMPT = `Eres un experto en extractos bancarios españoles. Analiza el texto del extracto y extrae TODOS los movimientos bancarios visibles.

Reglas:
- Devuelve SOLO un JSON válido (sin markdown) con esta forma:
  { "movements": [ { "movementDate": "YYYY-MM-DD", "valueDate": "YYYY-MM-DD|null", "concept": "texto", "reference": "texto|null", "amount": número, "balance": número|null } ] }
- amount: positivo = abono/ingreso en cuenta; negativo = cargo/salida.
- Ignora cabeceras, totales y líneas de saldo inicial/final sin movimiento.
- Normaliza fechas a YYYY-MM-DD.
- Importes en euros, punto decimal (1234.56).
- Si no hay movimientos legibles, devuelve movements: [].`

function getApiKey(): string {
  return process.env.DEEPSEEK_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || ""
}

function getClient(): OpenAI {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new OcrConfigError("DEEPSEEK_API_KEY no está configurada.")
  }
  return new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL })
}

function getModel(): string {
  return (
    process.env.DEEPSEEK_INVOICE_MODEL?.trim() ||
    process.env.OPENAI_INVOICE_MODEL?.trim() ||
    "deepseek-chat"
  )
}

function parseMovementDraft(raw: unknown): BankMovementDraft | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const movementDate = typeof row.movementDate === "string" ? row.movementDate.slice(0, 10) : null
  const amount = typeof row.amount === "number" ? row.amount : Number(row.amount)
  if (!movementDate || !Number.isFinite(amount) || amount === 0) return null

  return {
    movementDate,
    valueDate:
      typeof row.valueDate === "string" && row.valueDate.length >= 10
        ? row.valueDate.slice(0, 10)
        : undefined,
    concept: typeof row.concept === "string" ? row.concept.trim() || "Movimiento bancario" : "Movimiento bancario",
    reference: typeof row.reference === "string" ? row.reference.trim() || undefined : undefined,
    amount: Math.round(amount * 100) / 100,
    balance:
      typeof row.balance === "number" && Number.isFinite(row.balance)
        ? Math.round(row.balance * 100) / 100
        : undefined,
  }
}

export async function extractBankMovementsFromText(text: string): Promise<BankMovementDraft[]> {
  const client = getClient()
  const response = await client.chat.completions.create({
    model: getModel(),
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: text.slice(0, 120_000) },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new OcrExtractionError("El OCR no devolvió movimientos.")

  let parsed: { movements?: unknown[] }
  try {
    parsed = JSON.parse(content) as { movements?: unknown[] }
  } catch {
    throw new OcrExtractionError("Respuesta OCR de extracto no válida.")
  }

  const movements = (parsed.movements ?? [])
    .map(parseMovementDraft)
    .filter((item): item is BankMovementDraft => item !== null)

  if (movements.length === 0) {
    throw new OcrExtractionError("No se detectaron movimientos en el extracto.")
  }

  return movements
}

export async function extractBankStatementPreview(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<BankImportPreview> {
  const lower = fileName.toLowerCase()
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf")

  if (!isPdf) {
    throw new OcrExtractionError("El OCR de extractos solo admite PDF con texto o escaneado exportado a PDF.")
  }

  const text = await extractTextFromPdf(buffer)
  if (!hasUsableExtractedText(text)) {
    throw new OcrExtractionError(
      "No se pudo leer texto del PDF. Exporta el extracto desde tu banco en CSV/Excel o usa un PDF con texto seleccionable.",
    )
  }

  const movements = await extractBankMovementsFromText(text)
  return {
    fileName,
    source: "OCR",
    movements,
    warnings: [],
  }
}
