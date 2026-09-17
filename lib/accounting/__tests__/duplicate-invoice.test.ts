import { describe, expect, it } from "vitest"
import { normalizeInvoiceNumberKey } from "@/lib/accounting/duplicate-invoice"
import { describeDuplicateInvoice } from "@/lib/accounting/duplicate-invoice-message"

describe("normalizeInvoiceNumberKey", () => {
  it("treats spacing and punctuation as the same invoice number", () => {
    expect(normalizeInvoiceNumberKey("FT 48282")).toBe("FT48282")
    expect(normalizeInvoiceNumberKey("ft-48282")).toBe("FT48282")
    expect(normalizeInvoiceNumberKey("  FT.48282 ")).toBe("FT48282")
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

