import { CanvasFactory } from "@/lib/ocr/pdf-server-setup"
import { PDFParse } from "pdf-parse"

const MAX_PAGES = 8
const PAGE_WIDTH = 900

export async function renderPdfPageDataUrls(buffer: Buffer, maxPages = MAX_PAGES): Promise<string[]> {
  const parser = new PDFParse({ data: buffer, CanvasFactory })

  try {
    const result = await parser.getScreenshot({
      first: maxPages,
      desiredWidth: PAGE_WIDTH,
      imageDataUrl: true,
      imageBuffer: false,
    })

    return result.pages
      .map((page) => page.dataUrl)
      .filter((url): url is string => typeof url === "string" && url.startsWith("data:image/"))
  } finally {
    await parser.destroy()
  }
}

export function imageBufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const mime = mimeType === "image/jpg" ? "image/jpeg" : mimeType
  return `data:${mime};base64,${buffer.toString("base64")}`
}
