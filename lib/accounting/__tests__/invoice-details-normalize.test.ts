import { describe, expect, it } from "vitest"
import { parseInvoiceDetails } from "@/lib/accounting/entry-payload"
import { invoiceDetailsFromOcr, normalizeInvoiceDetails } from "@/lib/accounting/invoice-details-normalize"
import { buildFullInvoiceEntry } from "@/lib/accounting/invoice-auto-fill"
import { createEmptyLine } from "@/lib/accounting/command-templates"
import type { InvoiceOcrResult } from "@/lib/types/invoice"

const ocrInvoice: InvoiceOcrResult = {
  proveedor: "ESTACION SERVICIO MATARO S.L.",
  cif: "B12345678",
  numeroFactura: "FT 48391",
  fechaFactura: "2026-08-23",
  iva_desglose: [{ base_imponible: 12.43, tipo_iva: 21, cuota_iva: 2.61 }],
  recargo_equivalencia: null,
  baseImponible: 12.43,
  iva: 2.61,
  total: 15.04,
  isIntracomunitaria: false,
  isSujetoPasivo: false,
}

describe("normalizeInvoiceDetails from OCR payloads", () => {
  it("maps iva_desglose to vatLines so the editor can open the asiento", () => {
    const details = normalizeInvoiceDetails(ocrInvoice)

    expect(details?.invoiceNumber).toBe("FT 48391")
    expect(details?.thirdPartyName).toBe("ESTACION SERVICIO MATARO S.L.")
    expect(details?.nif).toBe("B12345678")
    expect(details?.vatLines).toHaveLength(1)
    expect(details?.vatLines[0]?.vatPercent).toBe(21)
    expect(details?.vatLines[0]?.base).toBe(12.43)
    expect(details?.vatLines[0]?.quota).toBe(2.61)
    expect(details?.vatLines[0]?.vatType).toBe("04")
  })

  it("parses stored OCR JSON the same way as persisted invoice details", () => {
    const parsed = parseInvoiceDetails(JSON.stringify(ocrInvoice))
    expect(parsed?.vatLines[0]?.base).toBe(12.43)
    expect(parsed?.vatLines[0]).toBeDefined()
  })

  it("keeps existing vatLines when the payload is already an invoice editor object", () => {
    const stored = invoiceDetailsFromOcr(ocrInvoice)
    const parsed = parseInvoiceDetails(JSON.stringify({ ...stored, cif: ocrInvoice.cif }))
    expect(parsed?.vatLines[0]?.quota).toBe(2.61)
    expect(parsed?.nif).toBe("B12345678")
  })

  it("rebuilds the asiento from the third-party total without crashing", () => {
    const details = invoiceDetailsFromOcr(ocrInvoice)
    const lines = [
      { ...createEmptyLine(), cuenta: "410.0003", concepto: "Proveedor", haber: 15.04 },
      { ...createEmptyLine(), cuenta: "472", concepto: "IVA", debe: 2.61 },
      { ...createEmptyLine(), cuenta: "628.0001", concepto: "Gasto", debe: 12.43 },
    ]

    const built = buildFullInvoiceEntry(lines, details, {
      activeCommand: "34",
      invoiceMode: "recibida",
      total: 15.04,
    })

    expect(built.details.vatLines[0]?.base).toBe(12.43)
    expect(built.details.vatLines[0]?.quota).toBe(2.61)
    expect(built.lines[0]?.haber).toBe(15.04)
  })

  it("creates a default vat line when vatLines is missing", () => {
    const details = normalizeInvoiceDetails({
      invoiceNumber: "X-1",
      thirdPartyName: "Proveedor",
      nif: "B00000000",
    })
    expect(details?.vatLines).toHaveLength(1)
    expect(details?.vatLines[0]?.vatPercent).toBe(21)
  })
})
