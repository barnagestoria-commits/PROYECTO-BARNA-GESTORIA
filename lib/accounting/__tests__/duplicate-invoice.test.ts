import { describe, expect, it } from "vitest"
import {
  invoiceNumbersCompatible,
  isDuplicateInvoiceSignal,
  normalizeInvoiceNumberKey,
  shouldProbeDuplicateInvoice,
} from "@/lib/accounting/duplicate-invoice"
import { describeDuplicateInvoice } from "@/lib/accounting/duplicate-invoice-message"

describe("normalizeInvoiceNumberKey", () => {
  it("treats spacing and punctuation as the same invoice number", () => {
    expect(normalizeInvoiceNumberKey("FT 48282")).toBe("FT48282")
    expect(normalizeInvoiceNumberKey("ft-48282")).toBe("FT48282")
    expect(normalizeInvoiceNumberKey("  FT.48282 ")).toBe("FT48282")
  })
})

describe("invoiceNumbersCompatible", () => {
  it("matches the last 5 or 8 digits typed in asiento rápido against the full OCR number", () => {
    expect(invoiceNumbersCompatible("2604-293", "604293")).toBe(true)
    expect(invoiceNumbersCompatible("2604293", "604293")).toBe(true)
    expect(invoiceNumbersCompatible("FT 48282", "48282")).toBe(true)
    expect(invoiceNumbersCompatible("ESDRI261637", "261637")).toBe(true)
  })

  it("does not treat a short document like 01 as the same invoice", () => {
    expect(invoiceNumbersCompatible("2604-293", "01")).toBe(false)
    expect(invoiceNumbersCompatible("2604-293", "293")).toBe(false)
  })
})

describe("isDuplicateInvoiceSignal", () => {
  const stored = {
    cif: "B61678843",
    numeroFactura: "2604-293",
    fechaFactura: "2026-09-01",
    total: 54.45,
    accountCode: "410.0004",
  }

  it("flags a manual entry that only has the tail of the invoice number", () => {
    expect(
      isDuplicateInvoiceSignal(
        {
          cif: "B61678843",
          numeroFactura: "604293",
          fechaFactura: "2026-09-01",
          total: 54.45,
          accountCode: "410.0004",
        },
        stored,
      ),
    ).toBe(true)
  })

  it("flags the same supplier, date and amount even without the full number", () => {
    expect(
      isDuplicateInvoiceSignal(
        {
          cif: "B61678843",
          numeroFactura: "",
          fechaFactura: "2026-09-01",
          total: 54.45,
          accountCode: "410.0004",
        },
        stored,
      ),
    ).toBe(true)
  })

  it("does not flag a different supplier with the same amount and date", () => {
    expect(
      isDuplicateInvoiceSignal(
        {
          cif: "A84919760",
          numeroFactura: "604293",
          fechaFactura: "2026-09-01",
          total: 54.45,
          accountCode: "410.0009",
        },
        stored,
      ),
    ).toBe(false)
  })

  it("does not flag two different invoices of the same supplier on the same day", () => {
    expect(
      isDuplicateInvoiceSignal(
        {
          cif: "B61678843",
          numeroFactura: "99999",
          fechaFactura: "2026-09-01",
          total: 54.45,
          accountCode: "410.0004",
        },
        stored,
      ),
    ).toBe(false)
  })
})

describe("shouldProbeDuplicateInvoice", () => {
  it("checks invoice commands and tails of 5+ digits, but not a payroll 01", () => {
    expect(shouldProbeDuplicateInvoice("34", { numeroFactura: "01", total: 12 })).toBe(true)
    expect(shouldProbeDuplicateInvoice(null, { numeroFactura: "604293", total: 54.45 })).toBe(true)
    expect(shouldProbeDuplicateInvoice(null, { numeroFactura: "01", total: 79.7 })).toBe(false)
  })
})

describe("describeDuplicateInvoice", () => {
  it("explains the existing entry in a way that can be shown in a blocking dialog", () => {
    expect(
      describeDuplicateInvoice({
        entryId: "entry-1",
        refNumber: 14,
        invoiceNumber: "FT 48391",
        fecha: "2026-09-17",
      }),
    ).toBe("Ya existe el asiento 14 con el nº FT 48391 (17/09/2026).")
  })
})

