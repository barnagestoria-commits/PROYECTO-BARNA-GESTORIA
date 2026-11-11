import { describe, expect, it } from "vitest"
import { decryptCertificatePayload, encryptCertificatePayload } from "@/lib/storage/certificate-crypto"

describe("certificate envelope crypto", () => {
  it("round-trips the PKCS12 and password for the same company", () => {
    const p12 = Buffer.from("fake-pkcs12-bytes")
    const envelope = encryptCertificatePayload({
      companyId: "company-a",
      p12,
      password: "secret-pass",
    })

    expect(envelope.includes(p12)).toBe(false)
    const recovered = decryptCertificatePayload("company-a", envelope)
    expect(recovered.p12.equals(p12)).toBe(true)
    expect(recovered.password).toBe("secret-pass")
  })

  it("fails if another company tries to open the envelope", () => {
    const envelope = encryptCertificatePayload({
      companyId: "company-a",
      p12: Buffer.from("cert"),
      password: "x",
    })
    expect(() => decryptCertificatePayload("company-b", envelope)).toThrow()
  })
})
