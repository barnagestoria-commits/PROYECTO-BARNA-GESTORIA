import { CanvasFactory } from "@/lib/ocr/pdf-server-setup"
import { PDFParse } from "pdf-parse"

/** Tope de seguridad para un único PDF (lotes grandes se suben como varios archivos). */
export const MAX_PDF_PAGES = 40
const PAGE_WIDTH = 900

export interface PdfPageRenderResult {
  dataUrls: string[]
  totalPages: number
  renderedPages: number
  truncated: boolean
}

export async function renderPdfPageDataUrls(
  buffer: Buffer,
  maxPages = MAX_PDF_PAGES,
): Promise<PdfPageRenderResult> {
  const parser = new PDFParse({ data: buffer, CanvasFactory })

  try {
    const info = await parser.getInfo()
    const totalPages = Number.isFinite(info.total) ? info.total : 0
    const last = Math.min(totalPages, maxPages)

    if (last <= 0) {
      return { dataUrls: [], totalPages, renderedPages: 0, truncated: false }
    }

    const result = await parser.getScreenshot({
      first: 1,
      last,
      desiredWidth: PAGE_WIDTH,
      imageDataUrl: true,
      imageBuffer: false,
    })

    const dataUrls = result.pages
      .map((page) => page.dataUrl)
      .filter((url): url is string => typeof url === "string" && url.startsWith("data:image/"))

    return {
      dataUrls,
      totalPages,
      renderedPages: dataUrls.length,
      truncated: totalPages > maxPages,
    }
  } finally {
    await parser.destroy()
  }
}

export function imageBufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const mime = mimeType === "image/jpg" ? "image/jpeg" : mimeType
  return `data:${mime};base64,${buffer.toString("base64")}`
}
