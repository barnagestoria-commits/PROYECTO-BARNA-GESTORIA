import { describe, expect, it } from "vitest"
import {
  chunkPages,
  invoiceIdentity,
  mergeExtractedInvoices,
} from "@/lib/ocr/invoice-page-batch"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

function invoice(overrides: Partial<InvoiceOcrResult> = {}): InvoiceOcrResult {
  return {
    proveedor: "Estacion Servicio",
    cif: "B08348666",
    numeroFactura: "FT 1",
    fechaFactura: "2026-08-15",
    iva_desglose: [{ base_imponible: 6.61, tipo_iva: 21, cuota_iva: 1.39 }],
    recargo_equivalencia: null,
    baseImponible: 6.61,
    iva: 1.39,
    total: 8,
    isIntracomunitaria: false,
    isSujetoPasivo: false,
    ...overrides,
  }
}

describe("invoice-page-batch", () => {
  it("splits 13 pages into overlapping vision chunks so no page is dropped", () => {
    const pages = Array.from({ length: 13 }, (_, index) => index + 1)
    const chunks = chunkPages(pages, 6, 1)

    expect(chunks[0]).toEqual([1, 2, 3, 4, 5, 6])
    expect(chunks.at(-1)?.at(-1)).toBe(13)
    expect(chunks.flat()).toEqual(expect.arrayContaining(pages))
    expect(new Set(chunks.flat()).size).toBe(13)
  })

  it("dedupes the same invoice when it appears in two page chunks", () => {
    const first = invoice({ numeroFactura: "FT 48282" })
    const second = invoice({ numeroFactura: "FT 48283" })
    const merged = mergeExtractedInvoices([[first], [first, second]])

    expect(merged).toHaveLength(2)
    expect(merged.map((item) => item.numeroFactura)).toEqual(["FT 48282", "FT 48283"])
  })

  it("uses CIF, number and date as identity", () => {
    expect(invoiceIdentity(invoice())).toBe("B08348666|FT 1|2026-08-15")
  })

  it("orders the validation queue by its real PDF page", () => {
    const merged = mergeExtractedInvoices([
      [
        invoice({ numeroFactura: "FT 13", pagina: 13, paginaFin: 13 }),
        invoice({ numeroFactura: "FT 1", pagina: 1, paginaFin: 1 }),
      ],
    ])

    expect(merged.map((item) => item.pagina)).toEqual([1, 13])
  })
})
