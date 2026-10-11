import { describe, expect, it } from "vitest"
import { formatAccountNameDisplay, formatListingText } from "@/lib/reports/format"
import { groupInvoiceRegister, type InvoiceRegisterRow } from "@/lib/reports/invoice-register"
import { getAccountLabel } from "@/lib/reports/pgc-labels"
import { getChartAccountName } from "@/lib/reports/pgc-chart-plans"

describe("account name display", () => {
  it("uppercases PGC names with Spanish locale", () => {
    expect(formatAccountNameDisplay("Capital social")).toBe("CAPITAL SOCIAL")
    expect(formatAccountNameDisplay("Acciones o participaciones propias")).toBe(
      "ACCIONES O PARTICIPACIONES PROPIAS",
    )
  })

  it("returns chart and ledger labels in uppercase", () => {
    expect(getChartAccountName("100")).toBe("CAPITAL SOCIAL")
    expect(getAccountLabel("629")).toBe("OTROS SERVICIOS")
    expect(getAccountLabel("410")).toBe("ACREEDORES POR PRESTACIONES DE SERVICIOS")
  })

  it("muestra en mayúsculas el tercero y el resto de textos del libro de facturas", () => {
    expect(formatListingText("Estació Servei Mataró, S")).toBe("ESTACIÓ SERVEI MATARÓ, S")
    const row: InvoiceRegisterRow = {
      book: "emitidas",
      isoDate: "2026-08-15",
      date: "15/08/2026",
      number: "es145366 26 00001",
      party: "Retail Servicer Spain SL",
      nif: "b72612690",
      base: 27.45,
      vatRate: 21,
      vatQuota: 5.76,
      total: 33.21,
      operation: "Operaciones interiores",
      invoiceType: "F1",
      rectificativa: false,
    }
    const [section] = groupInvoiceRegister([row], {
      from: "2026-08-01",
      to: "2026-08-31",
      book: "emitidas",
      withTotal: true,
      splitRectificativas: true,
      splitOperation: true,
    })
    expect(section?.title).toBe("FACTURAS EMITIDAS — OPERACIONES INTERIORES")
    expect(section?.rows[0]?.party).toBe("RETAIL SERVICER SPAIN SL")
    expect(section?.rows[0]?.number).toBe("ES145366 26 00001")
    expect(section?.rows[0]?.nif).toBe("B72612690")
  })
})
