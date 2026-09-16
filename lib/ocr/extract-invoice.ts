import type { InvoiceOcrResult } from "@/lib/types/invoice"
import {
  extractPdfTextContent,
  hasUsableExtractedText,
  type PdfTextContent,
} from "@/lib/ocr/extract-pdf-text"
import { imageBufferToDataUrl, MAX_PDF_PAGES, renderPdfPageDataUrls } from "@/lib/ocr/extract-pdf-pages"
import { extractInvoicesFromDocument } from "@/lib/ocr/extract-invoice-deepseek"
import { OcrExtractionError } from "@/lib/ocr/errors"

interface ExtractInvoiceInput {
  buffer: Buffer
  mimeType: string
  fileName: string
  documentType?: "factura-recibida" | "factura-emitida"
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

async function safePdfText(buffer: Buffer): Promise<PdfTextContent> {
  try {
    return await extractPdfTextContent(buffer)
  } catch (error) {
    console.error("[ocr] pdf-text", error)
    return { text: "", pages: [] }
  }
}

async function safePdfScreenshots(buffer: Buffer) {
  try {
    return await renderPdfPageDataUrls(buffer)
  } catch (error) {
    console.error("[ocr] pdf-screenshot", error)
    return {
      dataUrls: [] as string[],
      totalPages: 0,
      renderedPages: 0,
      truncated: false,
    }
  }
}

/**
 * Extrae una o varias facturas/tickets desde PDF (texto + fotos de página) o imagen.
 */
export async function extractInvoiceData(input: ExtractInvoiceInput): Promise<InvoiceOcrResult[]> {
  const mimeType = resolveMimeType(input.mimeType, input.fileName)

  if (isPdf(mimeType, input.fileName)) {
    const [pdfText, pageRender] = await Promise.all([
      safePdfText(input.buffer),
      safePdfScreenshots(input.buffer),
    ])

    const text = hasUsableExtractedText(pdfText.text) ? pdfText.text : pdfText.text.trim()
    if (!text && pageRender.dataUrls.length === 0) {
      throw new OcrExtractionError(
        "No se pudo leer el PDF. Prueba con un archivo más nítido o sube fotos de cada ticket.",
      )
    }

    const invoices = await extractInvoicesFromDocument({
      text,
      pageTexts: pdfText.pages,
      imageDataUrls: pageRender.dataUrls,
      documentType: input.documentType,
    })

    if (pageRender.truncated) {
      console.warn(
        `[ocr] PDF truncado: ${pageRender.totalPages} páginas, se analizaron las primeras ${MAX_PDF_PAGES}.`,
      )
    }

    return invoices
  }

  if (mimeType.startsWith("image/")) {
    return extractInvoicesFromDocument({
      imageDataUrls: [imageBufferToDataUrl(input.buffer, mimeType)],
      documentType: input.documentType,
    })
  }

  throw new OcrExtractionError("Formato de archivo no soportado.")
}
