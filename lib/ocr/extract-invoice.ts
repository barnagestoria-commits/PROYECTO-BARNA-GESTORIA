import type { InvoiceOcrResult } from "@/lib/types/invoice"
import { extractTextFromPdf, hasUsableExtractedText } from "@/lib/ocr/extract-pdf-text"
import { imageBufferToDataUrl, renderPdfPageDataUrls } from "@/lib/ocr/extract-pdf-pages"
import { extractInvoicesFromDocument } from "@/lib/ocr/extract-invoice-deepseek"
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

async function safePdfText(buffer: Buffer): Promise<string> {
  try {
    return await extractTextFromPdf(buffer)
  } catch (error) {
    console.error("[ocr] pdf-text", error)
    return ""
  }
}

async function safePdfScreenshots(buffer: Buffer): Promise<string[]> {
  try {
    return await renderPdfPageDataUrls(buffer)
  } catch (error) {
    console.error("[ocr] pdf-screenshot", error)
    return []
  }
}

/**
 * Extrae una o varias facturas/tickets desde PDF (texto + fotos de página) o imagen.
 */
export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<InvoiceOcrResult[]> {
  const mimeType = resolveMimeType(input.mimeType, input.fileName)

  if (isPdf(mimeType, input.fileName)) {
    const [pdfText, pageImages] = await Promise.all([
      safePdfText(input.buffer),
      safePdfScreenshots(input.buffer),
    ])

    const text = hasUsableExtractedText(pdfText) ? pdfText : pdfText.trim()
    if (!text && pageImages.length === 0) {
      throw new OcrExtractionError(
        "No se pudo leer el PDF. Prueba con un archivo más nítido o sube fotos de cada ticket.",
      )
    }

    return extractInvoicesFromDocument({
      text,
      imageDataUrls: pageImages,
    })
  }

  if (mimeType.startsWith("image/")) {
    return extractInvoicesFromDocument({
      imageDataUrls: [imageBufferToDataUrl(input.buffer, mimeType)],
    })
  }

  throw new OcrExtractionError("Formato de archivo no soportado.")
}
