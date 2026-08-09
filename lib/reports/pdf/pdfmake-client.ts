import type { TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces"

// pdfmake 0.3 server API is CommonJS-only from the package root.
const pdfmake = require("pdfmake") as PdfMakeInstance
const pdfFontVfs = require("pdfmake/build/vfs_fonts") as Record<string, string>

interface PdfMakeInstance {
  virtualfs: {
    writeFileSync: (filename: string, content: Buffer) => void
  }
  setFonts: (fonts: TFontDictionary) => void
  createPdf: (docDefinition: TDocumentDefinitions) => {
    getBuffer: () => Promise<Buffer>
  }
}

const fonts: TFontDictionary = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
}

let initialized = false

function ensurePdfMakeReady(): void {
  if (initialized) return

  for (const [filename, data] of Object.entries(pdfFontVfs)) {
    if (!filename.endsWith(".ttf") || typeof data !== "string") continue
    pdfmake.virtualfs.writeFileSync(filename, Buffer.from(data, "base64"))
  }

  pdfmake.setFonts(fonts)
  initialized = true
}

export function createPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  ensurePdfMakeReady()
  return pdfmake.createPdf(docDefinition).getBuffer()
}
