import { type PDFDocument } from "pdf-lib"

/**
 * Las plantillas se sanitizan offline con scripts/sanitize-aeat-template.py.
 * No aplicar rectángulos en runtime: distorsionan el impreso oficial.
 */
export function sanitizeOfficialTemplate(_doc: PDFDocument, _modelCode: string): void {
  // noop — ver scripts/sanitize-aeat-template.py
}
