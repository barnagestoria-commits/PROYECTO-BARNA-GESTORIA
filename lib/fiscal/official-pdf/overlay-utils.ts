import { PDFDocument, StandardFonts, rgb, degrees, type PDFPage, type RGB } from "pdf-lib"
import { formatAeatAmount, formatAeatInteger } from "@/lib/fiscal/official-pdf/format-aeat-value"

export interface OverlayTextField {
  page: number
  x: number
  y: number
  maxWidth?: number
  eraseWidth?: number
  eraseHeight?: number
  align?: "left" | "right"
  size?: number
  kind?: "text" | "amount" | "integer"
}

export interface OverlayDraftContext {
  nif: string
  companyName: string
  year: number
  period: string
}

const DRAFT_WATERMARK = "BORRADOR NO VALIDO PARA PRESENTACION"
const FONT_SIZE = 9

export async function loadOfficialTemplate(modelCode: string): Promise<PDFDocument> {
  const { readFile } = await import("node:fs/promises")
  const { join } = await import("node:path")
  const templatePath = join(process.cwd(), "assets", "aeat-templates", `modelo-${modelCode}.pdf`)
  const bytes = await readFile(templatePath)
  return PDFDocument.load(bytes)
}

export function drawDraftWatermark(page: PDFPage, color: RGB = rgb(0.75, 0.1, 0.1)): void {
  const { width, height } = page.getSize()
  page.drawText(DRAFT_WATERMARK, {
    x: width * 0.08,
    y: height * 0.48,
    size: 22,
    color,
    rotate: degrees(-32),
    opacity: 0.18,
  })
}

function eraseField(page: PDFPage, field: OverlayTextField): void {
  const eraseWidth = field.eraseWidth ?? field.maxWidth ?? 72
  const eraseHeight = field.eraseHeight ?? 14
  const x =
    field.align === "right"
      ? field.x - eraseWidth
      : field.x
  page.drawRectangle({
    x,
    y: field.y - 2,
    width: eraseWidth,
    height: eraseHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  })
}

export function drawOverlayField(
  page: PDFPage,
  field: OverlayTextField,
  rawValue: string | number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
): void {
  let text: string
  if (typeof rawValue === "number") {
    if (field.kind === "integer") text = formatAeatInteger(rawValue)
    else if (field.kind === "amount") text = formatAeatAmount(rawValue)
    else text = String(rawValue)
  } else {
    text = rawValue
  }

  if (!text) return

  eraseField(page, field)

  const size = field.size ?? FONT_SIZE
  const textWidth = font.widthOfTextAtSize(text, size)
  const x =
    field.align === "right"
      ? field.x - textWidth
      : field.x

  page.drawText(text, {
    x,
    y: field.y,
    size,
    font,
    color: rgb(0, 0, 0),
  })
}

export async function finalizeDraftPdf(doc: PDFDocument): Promise<Buffer> {
  const pages = doc.getPages()
  for (const page of pages) {
    drawDraftWatermark(page)
  }
  const bytes = await doc.save()
  return Buffer.from(bytes)
}

export function drawIdentityBlock(
  pages: PDFPage[],
  fields: {
    nif: OverlayTextField
    companyName: OverlayTextField
    year: OverlayTextField
    period: OverlayTextField
  },
  context: OverlayDraftContext,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
): void {
  const page = pages[fields.nif.page]
  if (!page) return
  drawOverlayField(page, fields.nif, context.nif, font)
  drawOverlayField(page, fields.companyName, context.companyName, font)
  drawOverlayField(page, fields.year, String(context.year), font)
  drawOverlayField(page, fields.period, context.period, font)
}
