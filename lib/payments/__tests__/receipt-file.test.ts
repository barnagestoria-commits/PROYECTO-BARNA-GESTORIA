import { describe, expect, it } from "vitest"
import { isValidIban } from "@/lib/banking/iban"
import { DEFAULT_BANK_DETAILS } from "@/lib/payments/bank-transfer"
import { receiptStoredFileName, sniffReceiptContentType } from "@/lib/payments/receipt-file"

const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...new Array(16).fill(0)])

describe("sniffReceiptContentType", () => {
  it("recognises PDF, JPEG, PNG and WebP by content", () => {
    expect(sniffReceiptContentType(pad([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf")
    expect(sniffReceiptContentType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(sniffReceiptContentType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
    const webp = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(sniffReceiptContentType(webp)).toBe("image/webp")
  })

  it("rejects HTML or scripts renamed as a receipt", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>")
    expect(sniffReceiptContentType(html)).toBeNull()
  })

  it("rejects tiny or empty buffers", () => {
    expect(sniffReceiptContentType(new Uint8Array())).toBeNull()
    expect(sniffReceiptContentType(Uint8Array.from([0x25, 0x50, 0x44, 0x46]))).toBeNull()
  })
})

describe("receiptStoredFileName", () => {
  it("takes the extension from the real content, not from the name", () => {
    expect(receiptStoredFileName("recibo.html", "application/pdf")).toBe("recibo.pdf")
    expect(receiptStoredFileName("../../etc/passwd", "image/jpeg")).toBe("passwd.jpg")
    expect(receiptStoredFileName("", "image/png")).toBe("justificante.png")
  })
})

describe("default bank details", () => {
  it("ships with a valid IBAN", () => {
    expect(isValidIban(DEFAULT_BANK_DETAILS.iban)).toBe(true)
  })
})
