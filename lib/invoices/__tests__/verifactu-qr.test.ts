import { describe, expect, it } from "vitest"
import {
  buildVerifactuQrCaption,
  buildVerifactuVerificationUrl,
} from "@/lib/invoices/verifactu-qr"

describe("verifactu qr", () => {
  it("builds sandbox verification url with required params", () => {
    const url = buildVerifactuVerificationUrl({
      environment: "sandbox",
      issuerNif: "B67330225",
      invoiceNumber: "F-2026-001",
      issueDate: "2026-04-15",
      totalAmount: 1210,
      recordHash: "ABC123",
    })
    expect(url).toContain("prewww2.aeat.es")
    expect(url).toContain("nif=B67330225")
    expect(url).toContain("numserie=F-2026-001")
    expect(url).toContain("fecha=15-04-2026")
    expect(url).toContain("importe=1210.00")
    expect(url).toContain("huella=ABC123")
  })

  it("uses production host", () => {
    const url = buildVerifactuVerificationUrl({
      environment: "production",
      issuerNif: "B67330225",
      invoiceNumber: "1",
      issueDate: "2026-01-01",
      totalAmount: 100.5,
    })
    expect(url).toContain("agenciatributaria.gob.es")
    expect(url).not.toContain("huella=")
  })

  it("builds caption with environment label", () => {
    expect(buildVerifactuQrCaption("sandbox")).toContain("Sandbox")
    expect(buildVerifactuQrCaption("production")).toContain("Producción")
  })
})
