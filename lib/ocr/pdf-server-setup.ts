/**
 * pdf-parse v2 / pdfjs-dist requiere APIs de canvas en Node (DOMMatrix, etc.).
 * Debe cargarse antes de importar PDFParse. Ver docs de pdf-parse para Vercel.
 */
import "pdf-parse/worker"
import { CanvasFactory } from "pdf-parse/worker"

export { CanvasFactory }
