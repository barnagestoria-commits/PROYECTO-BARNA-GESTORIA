import { describe, expect, it } from "vitest"
import {
  OCR_FREE_INVOICE_LIMIT,
  OCR_QUOTA_MESSAGE,
  isOcrQuotaExhausted,
  ocrInvoiceUsage,
} from "@/lib/ocr/ocr-quota"

describe("ocr invoice trial quota", () => {
  it("gives every account eight free invoices", () => {
    expect(OCR_FREE_INVOICE_LIMIT).toBe(8)
    expect(ocrInvoiceUsage(0)).toEqual({ used: 0, limit: 8, remaining: 8 })
    expect(ocrInvoiceUsage(3)).toEqual({ used: 3, limit: 8, remaining: 5 })
  })

  it("blocks the ninth invoice with the subscription message", () => {
    expect(isOcrQuotaExhausted(8)).toBe(true)
    expect(isOcrQuotaExhausted(12)).toBe(true)
    expect(isOcrQuotaExhausted(7)).toBe(false)
    expect(OCR_QUOTA_MESSAGE).toBe(
      "Si deseas seguir utilizando esta función actualiza tu plan de suscripción",
    )
  })
})
