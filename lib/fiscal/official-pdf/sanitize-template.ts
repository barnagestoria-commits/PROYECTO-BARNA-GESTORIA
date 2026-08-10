import { rgb, type PDFDocument, type PDFPage } from "pdf-lib"

export interface SanitizeRegion {
  page: number
  x: number
  y: number
  width: number
  height: number
}

/** Borra texto pre-rellenado de justificantes AEAT antes del overlay. */
function drawSanitizeRegion(page: PDFPage, region: SanitizeRegion): void {
  page.drawRectangle({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  })
}

/** Regiones de borrado calibradas sobre modelo-303.pdf (justificante AEAT). */
const MODELO_303_SANITIZE: SanitizeRegion[] = [
  { page: 0, x: 35, y: 654, width: 540, height: 14 },
  { page: 0, x: 35, y: 676, width: 400, height: 16 },
  { page: 0, x: 440, y: 704, width: 120, height: 16 },
  { page: 0, x: 320, y: 24, width: 250, height: 360 },
  { page: 0, x: 400, y: 100, width: 170, height: 90 },
  { page: 1, x: 80, y: 800, width: 420, height: 16 },
  { page: 1, x: 170, y: 370, width: 400, height: 420 },
  { page: 2, x: 80, y: 800, width: 420, height: 16 },
  { page: 2, x: 120, y: 630, width: 120, height: 16 },
]

const GENERIC_IDENTITY_SANITIZE: SanitizeRegion[] = [
  { page: 0, x: 35, y: 654, width: 540, height: 14 },
  { page: 0, x: 35, y: 676, width: 400, height: 16 },
  { page: 0, x: 440, y: 704, width: 120, height: 16 },
]

const SANITIZE_BY_MODEL: Partial<Record<string, SanitizeRegion[]>> = {
  "303": MODELO_303_SANITIZE,
  "111": GENERIC_IDENTITY_SANITIZE,
  "349": GENERIC_IDENTITY_SANITIZE,
}

export function sanitizeOfficialTemplate(doc: PDFDocument, modelCode: string): void {
  const regions = SANITIZE_BY_MODEL[modelCode] ?? GENERIC_IDENTITY_SANITIZE
  const pages = doc.getPages()
  for (const region of regions) {
    const page = pages[region.page]
    if (page) drawSanitizeRegion(page, region)
  }
}
