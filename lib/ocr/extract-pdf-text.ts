import { PDFParse } from "pdf-parse"

const MIN_USABLE_TEXT_LENGTH = 80

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    return result.text?.trim() ?? ""
  } finally {
    await parser.destroy()
  }
}

export function hasUsableExtractedText(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().length >= MIN_USABLE_TEXT_LENGTH
}
