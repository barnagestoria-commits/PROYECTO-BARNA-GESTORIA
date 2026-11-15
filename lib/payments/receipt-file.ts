/**
 * Validación del justificante bancario. Se mira el contenido real del archivo (los primeros bytes),
 * no el nombre ni el tipo que declara el navegador, para que nadie suba un .html disfrazado de PDF.
 */

/** Vercel corta las peticiones a funciones en ~4,5 MB; dejamos margen para el resto del formulario. */
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024

export type ReceiptContentType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp"

export function sniffReceiptContentType(bytes: Uint8Array): ReceiptContentType | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value)

  if (bytes.length < 12) return null
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf" // %PDF-
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp" // RIFF....WEBP
  }
  return null
}

const EXTENSION_BY_TYPE: Record<ReceiptContentType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

/** Nombre seguro: el que ponga el cliente solo sirve de pista; la extensión sale del contenido real. */
export function receiptStoredFileName(originalName: string, contentType: ReceiptContentType): string {
  const base = originalName.split(/[/\\]/).pop() ?? "justificante"
  const withoutExtension = base.replace(/\.[A-Za-z0-9]{1,5}$/, "")
  const clean = withoutExtension.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) || "justificante"
  return `${clean}.${EXTENSION_BY_TYPE[contentType]}`
}
