import { describe, expect, it } from "vitest"
import { createEmptyLine } from "@/lib/accounting/command-templates"
import {
  buildFullInvoiceEntry,
  calculateAmountsFromTotal,
  isDerivedInvoiceAmountAccount,
} from "@/lib/accounting/invoice-auto-fill"
import { createDefaultInvoiceDetails } from "@/lib/types/invoice-entry-details"

function receivedLines() {
  return [
    { ...createEmptyLine(), cuenta: "410.00001", concepto: "Proveedor" },
    { ...createEmptyLine(), cuenta: "472", concepto: "IVA" },
    { ...createEmptyLine(), cuenta: "629.00001", concepto: "Gasto" },
  ]
}

describe("invoice auto-fill from third-party total", () => {
  it("recalculates base and VAT from the supplier total at 21%", () => {
    const details = createDefaultInvoiceDetails("2026-09-13")
    const amounts = calculateAmountsFromTotal(74.92, details)

    expect(amounts.base).toBe(61.92)
    expect(amounts.quota).toBe(13)
    expect(amounts.irpf).toBe(0)
    expect(amounts.total).toBe(74.92)
  })

  it("rebuilds a received invoice when the saved lines were wrong", () => {
    const details = {
      ...createDefaultInvoiceDetails("2026-09-13"),
      invoiceNumber: "ESDRI261637",
      thirdPartyName: "Catcher Marketplace SL",
      vatLines: [
        {
          id: "vat-1",
          operation: "1",
          base: 51.17,
          vatType: "04",
          vatPercent: 21,
          quota: 10.75,
          taxForm: "347",
        },
      ],
    }

    const stale = receivedLines().map((line, index) => {
      if (index === 0) return { ...line, haber: 74.92 }
      if (index === 1) return { ...line, debe: 13 }
      return { ...line, debe: 51.17 }
    })

    const { lines, details: nextDetails } = buildFullInvoiceEntry(stale, details, {
      activeCommand: "34",
      invoiceMode: "recibida",
      total: 74.92,
    })

    expect(nextDetails.vatLines[0]?.base).toBe(61.92)
    expect(nextDetails.vatLines[0]?.quota).toBe(13)
    expect(lines[0]?.haber).toBe(74.92)
    expect(lines[1]?.debe).toBe(13)
    expect(lines[2]?.debe).toBe(61.92)
    expect(lines[0]?.debe + lines[1]?.debe + lines[2]?.debe).toBeCloseTo(
      lines[0]?.haber + lines[1]?.haber + lines[2]?.haber,
      2,
    )
  })

  it("inserts the IRPF line and nets it from the supplier total", () => {
    const details = {
      ...createDefaultInvoiceDetails("2026-09-13"),
      thirdPartyName: "Consultor SL",
      applyIrpf: true,
      irpfPercent: 15,
      irpfAccount: "4751",
    }

    const { lines } = buildFullInvoiceEntry(receivedLines(), details, {
      activeCommand: "34",
      invoiceMode: "recibida",
      total: 106,
    })

    const irpf = lines.find((line) => line.cuenta.replace(/\D/g, "").startsWith("4751"))
    const gasto = lines.find((line) => line.cuenta.startsWith("629"))
    const iva = lines.find((line) => line.cuenta.replace(/\D/g, "").startsWith("472"))
    const proveedor = lines.find((line) => line.cuenta.startsWith("410"))

    expect(irpf?.haber).toBeGreaterThan(0)
    expect(gasto?.debe).toBeGreaterThan(0)
    expect(proveedor?.haber).toBe(106)
    expect((gasto?.debe ?? 0) + (iva?.debe ?? 0)).toBeCloseTo(
      (proveedor?.haber ?? 0) + (irpf?.haber ?? 0),
      2,
    )
  })

  it("treats expense, VAT and IRPF accounts as derived amounts", () => {
    expect(isDerivedInvoiceAmountAccount("629.00001")).toBe(true)
    expect(isDerivedInvoiceAmountAccount("600")).toBe(true)
    expect(isDerivedInvoiceAmountAccount("472")).toBe(true)
    expect(isDerivedInvoiceAmountAccount("4751")).toBe(true)
    expect(isDerivedInvoiceAmountAccount("410.00001")).toBe(false)
  })
})
