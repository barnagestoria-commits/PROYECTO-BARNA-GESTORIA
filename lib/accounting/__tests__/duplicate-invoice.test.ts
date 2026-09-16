import { describe, expect, it } from "vitest"
import { normalizeInvoiceNumberKey } from "@/lib/accounting/duplicate-invoice"

describe("normalizeInvoiceNumberKey", () => {
  it("treats spacing and punctuation as the same invoice number", () => {
    expect(normalizeInvoiceNumberKey("FT 48282")).toBe("FT48282")
    expect(normalizeInvoiceNumberKey("ft-48282")).toBe("FT48282")
    expect(normalizeInvoiceNumberKey("  FT.48282 ")).toBe("FT48282")
  })
})
