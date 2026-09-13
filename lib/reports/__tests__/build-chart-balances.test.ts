import { describe, expect, it } from "vitest"
import {
  aggregateMovementsByDetail,
  buildChartBalanceRows,
  countAccountsWithMovement,
} from "@/lib/reports/build-chart-balances"
import { getPlanAccountCodes } from "@/lib/reports/pgc-chart-plans"

describe("build-chart-balances", () => {
  it("keeps the full PYME chart even when only one invoice has movement", () => {
    const movements = new Map([
      ["472", { totalDebe: 10.75, totalHaber: 0 }],
      ["41000001", { totalDebe: 0, totalHaber: 61.92 }],
      ["62900001", { totalDebe: 51.17, totalHaber: 0 }],
    ])

    const rows = buildChartBalanceRows({
      planCodes: getPlanAccountCodes("PGC_PYME"),
      openedAccounts: [
        { code: "41000001", name: "Catcher Marketplace SL" },
        { code: "62900001", name: "Comisiones Catcher" },
      ],
      movements,
      detailLevel: "SUBCUENTAS",
    })

    expect(rows.length).toBeGreaterThan(100)
    expect(rows.find((row) => row.cuenta === "100")?.totalDebe).toBe(0)
    expect(rows.find((row) => row.cuenta === "41000001")?.label).toBe("Catcher Marketplace SL")
    expect(rows.find((row) => row.cuenta === "629")?.label).toBe("Otros servicios")
    expect(countAccountsWithMovement(rows)).toBe(3)
  })

  it("rolls subaccounts into the 3-digit parent for nivel 3", () => {
    const movements = new Map([
      ["41000001", { totalDebe: 0, totalHaber: 61.92 }],
      ["62900001", { totalDebe: 51.17, totalHaber: 0 }],
    ])

    const aggregated = aggregateMovementsByDetail(movements, "NIVEL_3")
    expect(aggregated.get("410")?.totalHaber).toBe(61.92)
    expect(aggregated.get("629")?.totalDebe).toBe(51.17)

    const rows = buildChartBalanceRows({
      planCodes: getPlanAccountCodes("PGC_PYME"),
      openedAccounts: [{ code: "41000001", name: "Catcher Marketplace SL" }],
      movements,
      detailLevel: "NIVEL_3",
    })

    expect(rows.find((row) => row.cuenta === "41000001")).toBeUndefined()
    expect(rows.find((row) => row.cuenta === "410")?.totalHaber).toBe(61.92)
  })

  it("uses a smaller chart for microempresas than for PGC general", () => {
    const micro = getPlanAccountCodes("PGC_MICRO")
    const pyme = getPlanAccountCodes("PGC_PYME")
    const general = getPlanAccountCodes("PGC_GENERAL")

    expect(micro.length).toBeLessThan(pyme.length)
    expect(pyme.length).toBeLessThan(general.length)
    expect(micro).toContain("629")
    expect(micro).not.toContain("160")
    expect(general).toContain("160")
  })
})
