import { describe, expect, it } from "vitest"
import {
  applyInvoiceConceptsToLines,
  buildRetentionConcept,
} from "@/lib/accounting/invoice-entry-concepts"
import { buildFullInvoiceEntry } from "@/lib/accounting/invoice-auto-fill"
import { createEmptyLine } from "@/lib/accounting/command-templates"
import { createDefaultInvoiceDetails } from "@/lib/types/invoice-entry-details"
import { calculateModelAmount, type RawEntryLine } from "@/lib/fiscal/panorama"
import {
  isIntracomunitariaLine,
  isModel111RetentionLine,
} from "@/lib/fiscal/fiscal-line-detection"
import { isIvaRepercutidoBridgeLine, isIvaSoportadoBridgeLine } from "@/lib/fiscal/iva-bridge-summary"
import { buildCalculationDetailRows } from "@/lib/fiscal/model-draft/calculation-rows"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

function toRawLines(
  lines: Array<{
    id: string
    cuenta: string
    concepto: string
    debe: number
    haber: number
  }>,
  fecha = "2026-02-15",
): RawEntryLine[] {
  return lines.map((line) => ({
    ...line,
    entryId: "entry-1",
    entry: { id: "entry-1", fecha: new Date(`${fecha}T12:00:00.000Z`), concepto: "34" },
  }))
}

describe("invoice concepts correlate with fiscal impresos", () => {
  it("applies IVA S./ and Gasto a on received invoice lines (command 34)", () => {
    const lines = applyInvoiceConceptsToLines(
      [
        { cuenta: "400000000000", concepto: "Proveedor", debe: 0, haber: 121 },
        { cuenta: "472000000000", concepto: "472", debe: 21, haber: 0 },
        { cuenta: "600000000000", concepto: "600", debe: 100, haber: 0 },
      ],
      "34",
      { invoiceNumber: "F-001", thirdPartyLabel: "Proveedor UE", invoiceMode: "recibida" },
    )

    expect(lines[1].concepto).toBe("IVA S./PROVEEDOR-UE")
    expect(lines[2].concepto).toBe("Gasto a PROVEEDOR-UE")
    expect(isIvaSoportadoBridgeLine(toRawLines([{ id: "iva", ...lines[1] }])[0])).toBe(true)
  })

  it("embeds EU VAT in IVA line for intracomunitaria invoices (modelo 349)", () => {
    const lines = applyInvoiceConceptsToLines(
      [
        { cuenta: "400000000000", concepto: "Proveedor", debe: 0, haber: 1210 },
        { cuenta: "472000000000", concepto: "472", debe: 210, haber: 0 },
        { cuenta: "600000000000", concepto: "600", debe: 1000, haber: 0 },
      ],
      "34",
      {
        invoiceNumber: "F-IE-1",
        thirdPartyLabel: "Google Ireland",
        invoiceMode: "recibida",
        euVatId: "IE6388047V",
      },
    )

    expect(lines[1].concepto).toBe("IVA S./GOOGLE-IRELAND IE6388047V")
    expect(isIntracomunitariaLine(toRawLines([{ id: "iva", ...lines[1] }])[0])).toBe(true)
  })

  it("uses Reten./ on IRPF lines for modelo 111 detection and detail nombre", () => {
    const lines = applyInvoiceConceptsToLines(
      [
        { cuenta: "400000000000", concepto: "Consultor SL", debe: 0, haber: 85 },
        { cuenta: "475100000000", concepto: "IRPF", debe: 0, haber: 15 },
        { cuenta: "472000000000", concepto: "472", debe: 17.5, haber: 0 },
        { cuenta: "629000000000", concepto: "629", debe: 67.5, haber: 0 },
      ],
      "34",
      { invoiceNumber: "C-44", thirdPartyLabel: "Consultor SL", invoiceMode: "recibida" },
    )

    const irpfLine = toRawLines([{ id: "irpf", ...lines[1] }])[0]
    expect(lines[1].concepto).toBe("Reten./CONSULTOR-SL")
    expect(isModel111RetentionLine(irpfLine)).toBe(true)

    const detail: FiscalModelDetailResponse = {
      modelCode: "111",
      modelLabel: "Modelo 111",
      year: 2026,
      quarter: 1,
      periodLabel: "1T 2026",
      amount: 15,
      status: "pendiente",
      statusLabel: "Pendiente",
      breakdown: [
        {
          key: "retenciones",
          label: "Retenciones practicadas",
          total: 15,
          lines: [
            {
              entryId: "entry-1",
              entryDate: "2026-02-15",
              lineId: "irpf",
              cuenta: lines[1].cuenta,
              concepto: lines[1].concepto,
              debe: 0,
              haber: 15,
              signedAmount: 15,
              category: "contributing",
            },
          ],
        },
      ],
    }

    const rows = buildCalculationDetailRows(detail)
    expect(rows[0]?.nombre).toBe("CONSULTOR-SL")
  })

  it("feeds manual invoice entry into modelo 303 bridge totals", () => {
    const baseLines = [
      { ...createEmptyLine(), cuenta: "430000000000", concepto: "Cliente" },
      { ...createEmptyLine(), cuenta: "477000000000", concepto: "477" },
      { ...createEmptyLine(), cuenta: "705000000000", concepto: "705" },
    ]

    const details = {
      ...createDefaultInvoiceDetails("2026-03-10"),
      invoiceNumber: "V-100",
      thirdPartyName: "Cliente Demo SL",
      nif: "B12345678",
      vatLines: [
        {
          id: "vat-1",
          operation: "1",
          base: 1000,
          vatType: "04",
          vatPercent: 21,
          quota: 210,
          taxForm: "347",
        },
      ],
    }

    const { lines } = buildFullInvoiceEntry(baseLines, details, {
      activeCommand: "17",
      invoiceMode: "emitida",
      total: 1210,
    })

    const raw = toRawLines(
      lines.map((line, index) => ({
        id: `line-${index}`,
        cuenta: line.cuenta,
        concepto: line.concepto,
        debe: line.debe,
        haber: line.haber,
      })),
      "2026-03-10",
    )

    const vatLine = raw.find((line) => isIvaRepercutidoBridgeLine(line))
    expect(vatLine?.concepto).toBe("IVA R./CLIENTE-DEMO-SL")

    const result = calculateModelAmount("303", raw, 2026, 1)
    expect(result.amount).toBe(210)
    expect(result.breakdown[0]?.key).toBe("repercutido")
  })

  it("buildRetentionConcept normalizes party names like A3", () => {
    expect(buildRetentionConcept("Consultor SL")).toBe("Reten./CONSULTOR-SL")
  })
})
