import { describe, expect, it } from "vitest"
import { honorariosAmountFromClientLine, isHonorariosLineForClient } from "@/lib/gestoria/honorarios"
import { resolveFilingCertificateSource } from "@/lib/certificate/filing-certificate"

describe("gestoria honorarios and representation cert", () => {
  it("matches issued invoices of the gestoría against the client CIF", () => {
    expect(
      isHonorariosLineForClient(
        {
          invoiceNumber: "F-12",
          accountCode: "4300001",
          cif: "B11111111",
          debe: 121,
          haber: 0,
        },
        "B-11.111.111",
      ),
    ).toBe(true)

    expect(
      isHonorariosLineForClient(
        {
          invoiceNumber: "F-12",
          accountCode: "4300001",
          cif: "B11111111",
          debe: 121,
          haber: 0,
        },
        "B22222222",
      ),
    ).toBe(false)

    expect(honorariosAmountFromClientLine({ debe: 121, haber: 0 })).toBe(121)
  })

  it("uses the client certificate when present and falls back to representation", () => {
    expect(
      resolveFilingCertificateSource({
        hasClientCertificate: true,
        hasRepresentationCertificate: true,
      }),
    ).toBe("client")

    expect(
      resolveFilingCertificateSource({
        hasClientCertificate: false,
        hasRepresentationCertificate: true,
      }),
    ).toBe("representation")

    expect(
      resolveFilingCertificateSource({
        hasClientCertificate: false,
        hasRepresentationCertificate: false,
      }),
    ).toBe("none")
  })
})
