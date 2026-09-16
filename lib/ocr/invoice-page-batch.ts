import type { InvoiceOcrResult } from "@/lib/types/invoice"

export const VISION_PAGE_CHUNK_SIZE = 6
export const VISION_PAGE_CHUNK_OVERLAP = 1

export function chunkPages<T>(
  items: T[],
  size = VISION_PAGE_CHUNK_SIZE,
  overlap = VISION_PAGE_CHUNK_OVERLAP,
): T[][] {
  if (items.length === 0) return []
  if (items.length <= size) return [items]

  const step = Math.max(1, size - overlap)
  const chunks: T[][] = []

  for (let start = 0; start < items.length; start += step) {
    const chunk = items.slice(start, start + size)
    chunks.push(chunk)
    if (start + size >= items.length) break
  }

  return chunks
}

export function invoiceIdentity(invoice: InvoiceOcrResult): string {
  const cif = invoice.cif.trim().toUpperCase()
  const number = invoice.numeroFactura.trim().toUpperCase()
  const date = invoice.fechaFactura.trim()
  const proveedor = invoice.proveedor.trim().toUpperCase()
  const total = invoice.total.toFixed(2)

  if (cif && number && date) return `${cif}|${number}|${date}`
  return `${proveedor}|${cif}|${number}|${date}|${total}`
}

export function mergeExtractedInvoices(batches: InvoiceOcrResult[][]): InvoiceOcrResult[] {
  const seen = new Set<string>()
  const merged: InvoiceOcrResult[] = []

  for (const batch of batches) {
    for (const invoice of batch) {
      const key = invoiceIdentity(invoice)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(invoice)
    }
  }

  return merged
    .map((invoice, index) => ({ invoice, index }))
    .sort((a, b) => {
      const pageA = a.invoice.pagina ?? Number.MAX_SAFE_INTEGER
      const pageB = b.invoice.pagina ?? Number.MAX_SAFE_INTEGER
      return pageA - pageB || a.index - b.index
    })
    .map(({ invoice }) => invoice)
}
