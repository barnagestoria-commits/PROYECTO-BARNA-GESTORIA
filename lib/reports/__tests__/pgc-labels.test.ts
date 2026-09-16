import { describe, expect, it } from "vitest"
import { formatAccountNameDisplay } from "@/lib/reports/format"
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
})
