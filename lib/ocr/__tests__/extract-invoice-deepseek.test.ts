import { describe, expect, it } from "vitest"
import {
  hasMeaningfulInvoice,
  parseInvoiceModelResponse,
} from "@/lib/ocr/extract-invoice-deepseek"
import { OcrExtractionError } from "@/lib/ocr/errors"

describe("parseInvoiceModelResponse", () => {
  it("reads a flat invoice object", () => {
    const invoices = parseInvoiceModelResponse(
      JSON.stringify({
        proveedor: "Taller Moto SL",
        cif: "B12345678",
        numeroFactura: "F-22",
        fechaFactura: "15/08/2026",
        baseImponible: 100,
        iva: 21,
        total: 121,
        iva_desglose: [{ base_imponible: 100, tipo_iva: 21, cuota_iva: 21 }],
      }),
    )

    expect(invoices).toHaveLength(1)
    expect(invoices[0].proveedor).toBe("Taller Moto SL")
    expect(invoices[0].cif).toBe("B12345678")
    expect(invoices[0].fechaFactura).toBe("2026-08-15")
    expect(invoices[0].total).toBe(121)
  })

  it("reads naturalezaCompra from the model JSON", () => {
    const [invoice] = parseInvoiceModelResponse(
      JSON.stringify({
        proveedor: "ESTACION SERVICIO MATARO S.L.",
        cif: "B08348666",
        numeroFactura: "FT 48282",
        fechaFactura: "2026-08-15",
        baseImponible: 6.61,
        iva: 1.39,
        total: 8,
        naturalezaCompra: "suministros",
      }),
    )

    expect(invoice.naturalezaCompra).toBe("suministros")
  })

  it("unwraps an invoices array from a ticket bundle", () => {
    const invoices = parseInvoiceModelResponse(
      JSON.stringify({
        invoices: [
          { proveedor: "Repsol", total: 48.5, baseImponible: 40.08, iva: 8.42 },
          { proveedor: "Parking Saba", total: 3.2, nif: "A87410758" },
        ],
      }),
    )

    expect(invoices).toHaveLength(2)
    expect(invoices[0].proveedor).toBe("Repsol")
    expect(invoices[1].cif).toBe("A87410758")
  })

  it("accepts snake_case fields", () => {
    const [invoice] = parseInvoiceModelResponse(
      JSON.stringify({
        razon_social: "Catcher Marketplace SL",
        nif: "B11223344",
        numero_factura: "T-9",
        fecha_factura: "2026-07-02",
        base_imponible: 10,
        iva: 2.1,
        total: 12.1,
      }),
    )

    expect(invoice.proveedor).toBe("Catcher Marketplace SL")
    expect(invoice.numeroFactura).toBe("T-9")
  })

  it("rejects empty JSON so the form is not shown blank", () => {
    expect(() => parseInvoiceModelResponse("{}")).toThrow(OcrExtractionError)
    expect(() => parseInvoiceModelResponse("[]")).toThrow(OcrExtractionError)
  })

  it("detects a meaningful invoice", () => {
    expect(
      hasMeaningfulInvoice({
        proveedor: "",
        cif: "",
        numeroFactura: "",
        fechaFactura: "",
        iva_desglose: [{ base_imponible: 0, tipo_iva: 21, cuota_iva: 0 }],
        recargo_equivalencia: null,
        baseImponible: 0,
        iva: 0,
        total: 0,
        isIntracomunitaria: false,
        isSujetoPasivo: false,
      }),
    ).toBe(false)
  })
})
