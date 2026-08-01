import type { A3JournalEntry } from "@/lib/imports/a3/types"

/** Referencias a proveedores/clientes detectadas en líneas del diario. */
export interface A3VendorRef {
  cif: string
  name: string
}

export function extractVendorRefsFromEntries(entries: A3JournalEntry[]): A3VendorRef[] {
  const map = new Map<string, string>()
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.vendorCif) {
        map.set(line.vendorCif, line.vendorName ?? line.vendorCif)
      }
    }
  }
  return [...map.entries()].map(([cif, name]) => ({ cif, name }))
}

export const A3_IMPORT_ENTRY_BATCH_SIZE = 150

/** ZIPs por debajo de este tamaño pueden usar el flujo clásico (subida directa). */
export const A3_DIRECT_UPLOAD_MAX_BYTES = 3 * 1024 * 1024

export function shouldUseClientSideA3Import(file: File): boolean {
  return file.size > A3_DIRECT_UPLOAD_MAX_BYTES
}

export function chunkA3Entries<T>(items: T[], size = A3_IMPORT_ENTRY_BATCH_SIZE): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
