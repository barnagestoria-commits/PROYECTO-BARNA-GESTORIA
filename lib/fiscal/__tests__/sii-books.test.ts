import { describe, expect, it } from "vitest"
import { buildSiiInvoices } from "@/lib/fiscal/sii/books"
import { buildSiiSoap } from "@/lib/fiscal/sii/xml"
import { parseFiscalRoutePeriod } from "@/lib/fiscal/panorama"

describe("periodo del 303", () => {
  it("distingue el mes 01 del primer trimestre", () => {
    expect(parseFiscalRoutePeriod("01")).toEqual({ kind: "month", month: 1, quarter: 1 })
    expect(parseFiscalRoutePeriod("1")).toEqual({ kind: "quarter", quarter: 1 })
    expect(parseFiscalRoutePeriod("12")?.kind).toBe("month")
  })
})

describe("libros SII", () => {
  it("prepara una factura emitida y deja fuera la que no tiene número", () => {
    const invoices = buildSiiInvoices({
      year: 2026,
      month: 11,
      cashBasisSubject: false,
      parties: [],
      entries: [
        {
          id: "1",
          fecha: "2026-11-02",
          issueDate: "2026-11-02",
          invoiceNumber: "A-10",
          commandCode: "17",
          invoiceDataJson: JSON.stringify({
            invoiceNumber: "A-10",
            issueDate: "2026-11-02",
            operationDate: "2026-11-02",
            thirdPartyName: "Cliente & Cía",
            nif: "B12345674",
            isRectificativa: false,
            vatLines: [{ id: "v", operation: "1", base: 100, vatType: "04", vatPercent: 21, quota: 21, taxForm: "347" }],
            applyIrpf: false,
            irpfPercent: 0,
            irpfAccount: "",
          }),
          lines: [],
        },
        {
          id: "2",
          fecha: "2026-11-03",
          invoiceNumber: "",
          commandCode: "17",
          lines: [{ cuenta: "700000", concepto: "Venta", debe: 0, haber: 50 }],
        },
      ],
    })

    expect(invoices[0]?.status).toBe("LISTA")
    expect(invoices[0]?.claveRegimen).toBe("01")
    expect(invoices[1]?.status).toBe("INCOMPLETA")

    const xml = buildSiiSoap({
      book: "EMITIDAS",
      titularNif: "B00000000",
      titularNombre: "Empresa",
      invoices: invoices.filter((invoice) => invoice.status === "LISTA"),
    })
    expect(xml).toContain("<sii:Periodo>11</sii:Periodo>")
    expect(xml).toContain("Cliente &amp; Cía")
    expect(xml).toContain("<sii:TipoFactura>F1</sii:TipoFactura>")
    expect(xml).not.toContain("A-sin")
  })
})