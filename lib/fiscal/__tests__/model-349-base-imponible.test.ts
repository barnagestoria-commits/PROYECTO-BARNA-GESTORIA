import { describe, expect, it } from "vitest"
import {
  extractEuVatIds,
  extractPrimaryEuVatId,
  formatEuVatIdForAeat,
} from "@/lib/fiscal/eu-vat-id"
import {
  buildModel349BreakdownLines,
  resolveModel349BaseImponible,
} from "@/lib/fiscal/model-349-base-imponible"
import { calculateModelAmount, type RawEntryLine } from "@/lib/fiscal/panorama"

function line(
  partial: Partial<RawEntryLine> & Pick<RawEntryLine, "concepto" | "debe" | "haber">,
): RawEntryLine {
  return {
    id: partial.id ?? "line-1",
    entryId: partial.entryId ?? partial.entry?.id ?? "entry-1",
    cuenta: partial.cuenta ?? "600000000000",
    concepto: partial.concepto,
    debe: partial.debe,
    haber: partial.haber,
    entry: partial.entry ?? {
      id: partial.entryId ?? "entry-1",
      fecha: new Date("2026-01-15T12:00:00.000Z"),
      concepto: null,
    },
  }
}

describe("eu-vat-id", () => {
  it("extracts and normalizes EU VAT numbers with country prefix", () => {
    expect(extractPrimaryEuVatId("IVA S./GOOGLE IE6388047V")).toBe("IE6388047V")
    expect(extractPrimaryEuVatId("Factura DE 123456789")).toBe("DE123456789")
    expect(extractPrimaryEuVatId("Cliente FR 12 345 678 901")).toBe("FR12345678901")
    expect(extractPrimaryEuVatId("IVA R./CLIENTE FR PT123456789")).toBe("PT123456789")
    expect(formatEuVatIdForAeat("GR123456789")).toBe("EL123456789")
  })

  it("ignores Spanish NIF/CIF", () => {
    expect(extractPrimaryEuVatId("Proveedor B12345678")).toBeNull()
    expect(extractEuVatIds("NIF B12345678 IT12345678901")).toEqual(["IT12345678901"])
  })
})

describe("resolveModel349BaseImponible", () => {
  it("uses purchase base on group 600 for IVA S.", () => {
    const entry = { id: "e1", fecha: new Date("2026-01-15T12:00:00.000Z"), concepto: null }
    const entryLines: RawEntryLine[] = [
      line({
        id: "base",
        concepto: "Compra mercancías UE",
        cuenta: "600000000000",
        debe: 10000,
        haber: 0,
        entry,
      }),
      line({
        id: "iva",
        concepto: "IVA S./DE123456789",
        cuenta: "472000000000",
        debe: 2100,
        haber: 0,
        entry,
      }),
      line({
        id: "supplier",
        concepto: "Proveedor alemán",
        cuenta: "400000000000",
        debe: 0,
        haber: 12100,
        entry,
      }),
    ]

    expect(resolveModel349BaseImponible(entryLines[1], entryLines)).toEqual({
      amount: 10000,
      baseLineId: "base",
      ivaLineId: "iva",
    })
  })

  it("uses sales base on group 700 for IVA R.", () => {
    const entry = { id: "e2", fecha: new Date("2026-02-10T12:00:00.000Z"), concepto: null }
    const entryLines: RawEntryLine[] = [
      line({
        id: "sales",
        concepto: "Venta intracomunitaria",
        cuenta: "700000000000",
        debe: 0,
        haber: 25000,
        entry,
      }),
      line({
        id: "iva-r",
        concepto: "IVA R./FR12345678901 CLIENTE FR",
        cuenta: "477000000000",
        debe: 0,
        haber: 0,
        entry,
      }),
      line({
        id: "customer",
        concepto: "Cliente francés",
        cuenta: "430000000000",
        debe: 25000,
        haber: 0,
        entry,
      }),
    ]

    expect(resolveModel349BaseImponible(entryLines[1], entryLines)).toEqual({
      amount: 25000,
      baseLineId: "sales",
      ivaLineId: "iva-r",
    })
  })
})

describe("calculateModelAmount for modelo 349", () => {
  it("totals base imponible instead of IVA lines", () => {
    const entry = { id: "e1", fecha: new Date("2026-01-15T12:00:00.000Z"), concepto: null }
    const lines: RawEntryLine[] = [
      line({
        id: "base",
        concepto: "Compra mercancías UE",
        cuenta: "600000000000",
        debe: 10000,
        haber: 0,
        entry,
      }),
      line({
        id: "iva",
        concepto: "IVA S./DE123456789",
        cuenta: "472000000000",
        debe: 2100,
        haber: 0,
        entry,
      }),
      line({
        id: "supplier",
        concepto: "Proveedor alemán",
        cuenta: "400000000000",
        debe: 0,
        haber: 12100,
        entry,
      }),
    ]

    const result = calculateModelAmount("349", lines, 2026, 1)
    expect(result.amount).toBe(10000)

    const contributing = result.breakdown[0].lines.filter((item) => item.category === "contributing")
    expect(contributing).toHaveLength(1)
    expect(contributing[0].lineId).toBe("base")
    expect(contributing[0].signedAmount).toBe(10000)
    expect(contributing[0].model349SourceLineId).toBe("iva")
  })

  it("builds breakdown with base line as contributing", () => {
    const entry = { id: "e2", fecha: new Date("2026-02-10T12:00:00.000Z"), concepto: null }
    const matched = [
      line({
        id: "iva-r",
        concepto: "IVA R./PT123456789",
        cuenta: "477000000000",
        debe: 0,
        haber: 0,
        entry,
      }),
    ]
    const allLines: RawEntryLine[] = [
      line({
        id: "sales",
        concepto: "Venta UE",
        cuenta: "700000000000",
        debe: 0,
        haber: 18000,
        entry,
      }),
      ...matched,
    ]

    const breakdown = buildModel349BreakdownLines(allLines, matched)
    const contributing = breakdown.filter((item) => item.category === "contributing")
    expect(contributing[0].lineId).toBe("sales")
    expect(contributing[0].signedAmount).toBe(18000)
  })
})
