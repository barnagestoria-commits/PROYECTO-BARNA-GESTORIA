import { describe, expect, it } from "vitest"
import { entryMatchesSearch, parseEntrySearchQuery, parseSearchAmount } from "@/lib/accounting/entry-search"
import type { SearchableEntry } from "@/lib/accounting/entry-search"

const sale: SearchableEntry = {
  refNumber: 23,
  fecha: "2026-09-30",
  commandCode: "17",
  invoiceNumber: "FV-14",
  invoiceDataJson: null,
  lines: [
    { cuenta: "430.0001", concepto: "Nuestra factura N. FV-14", debe: 1520.82, haber: 0 },
    { cuenta: "477.0000", concepto: "IVA R./RETAIL-SERVICER-SPAIN-SL", debe: 0, haber: 264.24 },
    { cuenta: "705.0000", concepto: "Ventas a RETAIL-SERVICER-SPAIN-SL", debe: 0, haber: 1256.58 },
  ],
}

describe("parseSearchAmount", () => {
  it("reads Spanish amounts and leaves account codes alone", () => {
    expect(parseSearchAmount("1.520,82")).toBe(1520.82)
    expect(parseSearchAmount("27,45 €")).toBe(27.45)
    expect(parseSearchAmount("1520.82")).toBe(1520.82)
    expect(parseSearchAmount("430.0001")).toBeNull()
  })
})

describe("parseEntrySearchQuery", () => {
  it("keeps an integer as ref and as amount", () => {
    const parsed = parseEntrySearchQuery("23")
    expect(parsed?.refNumber).toBe(23)
    expect(parsed?.amount).toBe(23)
  })

  it("reads a local date", () => {
    expect(parseEntrySearchQuery("30/09/2026")?.date).toBe("2026-09-30")
  })

  it("reads a dotted account without treating it as money", () => {
    const parsed = parseEntrySearchQuery("430.0001")
    expect(parsed?.accountDigits).toBe("4300001")
    expect(parsed?.amount).toBeNull()
  })
})

describe("entryMatchesSearch", () => {
  it("finds the entry by a line amount", () => {
    const criteria = parseEntrySearchQuery("1.256,58")
    expect(criteria && entryMatchesSearch(sale, criteria)).toBe(true)
  })

  it("finds the entry by its total", () => {
    const criteria = parseEntrySearchQuery("1520,82")
    expect(criteria && entryMatchesSearch(sale, criteria)).toBe(true)
  })

  it("finds the entry by document number", () => {
    const criteria = parseEntrySearchQuery("FV-14")
    expect(criteria && entryMatchesSearch(sale, criteria)).toBe(true)
  })

  it("finds the entry by concept, account, date or ref", () => {
    expect(entryMatchesSearch(sale, parseEntrySearchQuery("retail")!)).toBe(true)
    expect(entryMatchesSearch(sale, parseEntrySearchQuery("705.0000")!)).toBe(true)
    expect(entryMatchesSearch(sale, parseEntrySearchQuery("30/09/2026")!)).toBe(true)
    expect(entryMatchesSearch(sale, parseEntrySearchQuery("23")!)).toBe(true)
  })

  it("does not match a different amount", () => {
    expect(entryMatchesSearch(sale, parseEntrySearchQuery("10,00")!)).toBe(false)
  })
})
