import { CanvasFactory } from "@/lib/ocr/pdf-server-setup"
import { PDFParse } from "pdf-parse"

const MIN_USABLE_TEXT_LENGTH = 80

export interface PdfTextContent {
  text: string
  pages: string[]
}

export async function extractPdfTextContent(buffer: Buffer): Promise<PdfTextContent> {
  const parser = new PDFParse({ data: buffer, CanvasFactory })

  try {
    const result = await parser.getText()
    return {
      text: result.text?.trim() ?? "",
      pages: result.pages.map((page) => page.text?.trim() ?? ""),
    }
  } finally {
    await parser.destroy()
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return (await extractPdfTextContent(buffer)).text
}

export function hasUsableExtractedText(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().length >= MIN_USABLE_TEXT_LENGTH
}
