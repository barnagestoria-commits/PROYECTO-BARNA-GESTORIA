import type { InvoiceOcrResult } from "@/lib/types/invoice"
import { extractTextFromPdf, hasUsableExtractedText } from "@/lib/ocr/extract-pdf-text"
import { extractInvoiceFromText } from "@/lib/ocr/extract-invoice-deepseek"
import { OcrExtractionError } from "@/lib/ocr/errors"

interface ExtractInvoiceInput {
  buffer: Buffer
  mimeType: string
  fileName: string
}

function resolveMimeType(mimeType: string, fileName: string): string {
  if (mimeType) return mimeType

  const extension = fileName.toLowerCase().split(".").pop()

  switch (extension) {
    case "pdf":
      return "application/pdf"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    default:
      return mimeType
  }
}

function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
}

/**
 * Extrae datos de factura usando texto del PDF y un modelo de IA para estructurar los campos.
 * Las imágenes deben contener texto legible o convertirse a PDF con texto seleccionable.
 */
export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<InvoiceOcrResult> {
  const mimeType = resolveMimeType(input.mimeType, input.fileName)

  if (isPdf(mimeType, input.fileName)) {
    const pdfText = await extractTextFromPdf(input.buffer)

    if (hasUsableExtractedText(pdfText)) {
      return extractInvoiceFromText(pdfText)
    }

    throw new OcrExtractionError(
      "No se pudo extraer texto del PDF. Usa facturas con texto seleccionable (no escaneadas sin OCR).",
    )
  }

  if (mimeType.startsWith("image/")) {
    throw new OcrExtractionError(
      "No se pudo analizar la imagen. Sube un PDF con texto seleccionable o una foto nítida de la factura.",
    )
  }

  throw new OcrExtractionError("Formato de archivo no soportado.")
}
