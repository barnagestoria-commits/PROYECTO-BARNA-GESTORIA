import type { TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces"
import pdfMake from "pdfmake/build/pdfmake"
import pdfFonts from "pdfmake/build/vfs_fonts"

const vfs = (pdfFonts as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> }).pdfMake?.vfs
  ?? (pdfFonts as { vfs?: Record<string, string> }).vfs
  ?? {}

const fonts: TFontDictionary = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
}

interface PdfPrinter {
  vfs: Record<string, string>
  fonts: TFontDictionary
  createPdf: (
    docDefinition: TDocumentDefinitions,
    tableLayouts?: unknown,
    fonts?: TFontDictionary,
    vfs?: Record<string, string>,
  ) => {
    getBuffer: (callback: (result: Buffer) => void) => void
  }
}

const printer = pdfMake as unknown as PdfPrinter
printer.vfs = vfs
printer.fonts = fonts

export function createPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const pdf = printer.createPdf(docDefinition, undefined, fonts, vfs)

  return new Promise((resolve, reject) => {
    try {
      pdf.getBuffer((buffer: Buffer) => resolve(buffer))
    } catch (error) {
      reject(error)
    }
  })
}
