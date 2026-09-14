import { describe, expect, it } from "vitest"
import {
  enrichBreakdownWithPartyIdentity,
  extractPartyDisplayName,
  extractSpanishTaxId,
} from "@/lib/fiscal/party-identification"
import { buildCalculationDetailRows } from "@/lib/fiscal/model-draft/calculation-rows"
import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"

describe("party identification for fiscal model detail", () => {
  it("does not treat hyphenated company names as EU VAT", () => {
    const concepto = "IVA R./RETAIL-SERVICER-SPAIN-SL"
    expect(extractSpanishTaxId(concepto)).toBeNull()
    expect(extractPartyDisplayName(concepto)).toBe("RETAIL-SERVICER-SPAIN-SL")
  })

  it("keeps a real EU VAT out of the displayed name", () => {
    expect(extractPartyDisplayName("IVA S./GOOGLE-IRELAND IE6388047V")).toBe("GOOGLE-IRELAND")
  })

  it("extracts a Spanish CIF from the concept when present", () => {
    expect(extractSpanishTaxId("IVA R./CLIENTE-DEMO-SL B12345678")).toBe("B12345678")
    expect(extractPartyDisplayName("IVA R./CLIENTE-DEMO-SL B12345678")).toBe("CLIENTE-DEMO-SL")
  })

  it("resolves NIF and legal name from the third-party directory via the sibling 430/400 line", () => {
    const breakdown = enrichBreakdownWithPartyIdentity(
      [
        {
          key: "repercutido",
          label: "IVA repercutido",
          total: 5.76,
          lines: [
            {
              entryId: "e1",
              entryDate: "2026-07-02",
              lineId: "iva",
              cuenta: "477",
              concepto: "IVA R./RETAIL-SERVICER-SPAIN-SL",
              debe: 0,
              haber: 5.76,
              signedAmount: 5.76,
              category: "contributing",
            },
          ],
        },
      ],
      [
        { entryId: "e1", cuenta: "430.0003", concepto: "Nuestra factura N. 12" },
        { entryId: "e1", cuenta: "477", concepto: "IVA R./RETAIL-SERVICER-SPAIN-SL" },
        { entryId: "e1", cuenta: "705", concepto: "Ventas a RETAIL-SERVICER-SPAIN-SL" },
      ],
      [
        {
          accountCode: "4300003",
          cif: "B66778899",
          name: "Retail Servicer Spain SL",
        },
      ],
    )

    expect(breakdown[0].lines[0].nif).toBe("B66778899")
    expect(breakdown[0].lines[0].nombre).toBe("Retail Servicer Spain SL")
  })

  it("fills 303 calculation rows from directory data for every user type", () => {
    const detail: FiscalModelDetailResponse = {
      modelCode: "303",
      modelLabel: "Modelo 303",
      year: 2026,
      quarter: 3,
      periodLabel: "3T 2026",
      amount: 211.64,
      status: "pendiente",
      statusLabel: "Pendiente",
      breakdown: [
        {
          key: "repercutido",
          label: "IVA repercutido",
          total: 5.76,
          lines: [
            {
              entryId: "e1",
              entryDate: "2026-07-02",
              lineId: "iva",
              cuenta: "477",
              concepto: "IVA R./RETAIL-SERVICER-SPAIN-SL",
              debe: 0,
              haber: 5.76,
              signedAmount: 5.76,
              category: "contributing",
              nif: "B66778899",
              nombre: "Retail Servicer Spain SL",
            },
          ],
        },
        {
          key: "soportado",
          label: "IVA soportado",
          total: 13,
          lines: [
            {
              entryId: "e2",
              entryDate: "2026-08-01",
              lineId: "iva2",
              cuenta: "472",
              concepto: "IVA S./CATCHER-MARKETPLACE-SL",
              debe: 13,
              haber: 0,
              signedAmount: 13,
              category: "contributing",
              nif: "B11223344",
              nombre: "Catcher Marketplace SL",
            },
          ],
        },
      ],
    }

    const rows = buildCalculationDetailRows(detail)
    expect(rows[0]?.nif).toBe("B66778899")
    expect(rows[0]?.nombre).toBe("Retail Servicer Spain SL")
    expect(rows[0]?.claveOperacion).toBe("01")
    expect(rows[1]?.nif).toBe("B11223344")
    expect(rows[1]?.nombre).toBe("Catcher Marketplace SL")
    expect(rows[1]?.claveOperacion).toBe("02")
  })
})
