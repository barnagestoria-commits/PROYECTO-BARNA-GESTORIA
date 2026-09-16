import { describe, expect, it } from "vitest"
import {
  aggregateMovementsByDetail,
  buildChartBalanceRows,
  buildMovementBalanceRows,
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
    expect(rows.find((row) => row.cuenta === "41000001")?.label).toBe("CATCHER MARKETPLACE SL")
    expect(rows.find((row) => row.cuenta === "629")?.label).toBe("OTROS SERVICIOS")
    expect(countAccountsWithMovement(rows)).toBe(3)
  })

  it("groups Catcher into 410 at nivel 3", () => {
    const movements = new Map([
      ["41000001", { totalDebe: 0, totalHaber: 61.92 }],
      ["62900001", { totalDebe: 51.17, totalHaber: 0 }],
    ])

    const aggregated = aggregateMovementsByDetail(movements, "NIVEL_3")
    expect(aggregated.get("410")?.totalHaber).toBe(61.92)
    expect(aggregated.get("629")?.totalDebe).toBe(51.17)
    expect(aggregated.get("41000001")).toBeUndefined()

    const rows = buildChartBalanceRows({
      planCodes: getPlanAccountCodes("PGC_PYME"),
      openedAccounts: [
        { code: "41000001", name: "Catcher Marketplace SL" },
        { code: "62900001", name: "Comisiones Catcher" },
      ],
      movements,
      detailLevel: "NIVEL_3",
    })

    expect(rows.find((row) => row.cuenta === "41000001")).toBeUndefined()
    expect(rows.find((row) => row.cuenta === "410")?.totalHaber).toBe(61.92)
    expect(rows.find((row) => row.cuenta === "629")?.totalDebe).toBe(51.17)
  })

  it("splits generic 4-digit accounts at nivel 4", () => {
    const aggregated = aggregateMovementsByDetail(
      new Map([
        ["62120000", { totalDebe: 6100.06, totalHaber: 0 }],
        ["47510000", { totalDebe: 0, totalHaber: 1159 }],
      ]),
      "NIVEL_4",
    )
    expect(aggregated.get("6212")?.totalDebe).toBe(6100.06)
    expect(aggregated.get("4751")?.totalHaber).toBe(1159)
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

  it("places Catcher 410.00001 next to group 410, not at the end of the list", () => {
    const rows = buildChartBalanceRows({
      planCodes: getPlanAccountCodes("PGC_PYME"),
      openedAccounts: [{ code: "41000001", name: "Catcher Marketplace SL" }],
      movements: new Map([["41000001", { totalDebe: 0, totalHaber: 61.92 }]]),
      detailLevel: "SUBCUENTAS",
    })
    const codes = rows.map((row) => row.cuenta)
    const group = codes.indexOf("410")
    const catcher = codes.indexOf("41000001")
    const nextGroup = codes.indexOf("411")

    expect(group).toBeGreaterThanOrEqual(0)
    expect(catcher).toBe(group + 1)
    expect(nextGroup).toBe(catcher + 1)
  })

  it("lists used subaccounts at subcuenta level even if they are not in the master file", () => {
    const rows = buildChartBalanceRows({
      planCodes: getPlanAccountCodes("PGC_PYME"),
      openedAccounts: [],
      movements: new Map([["41000001", { totalDebe: 0, totalHaber: 61.92 }]]),
      detailLevel: "SUBCUENTAS",
    })

    expect(rows.find((row) => row.cuenta === "41000001")?.totalHaber).toBe(61.92)
    expect(rows.find((row) => row.cuenta === "410")?.totalHaber).toBe(0)
  })

  it("lists Elgueta-style balances at the chosen detail level", () => {
    const movements = new Map([
      ["41000002", { totalDebe: 0, totalHaber: 46.15 }],
      ["41000035", { totalDebe: 0, totalHaber: 6222.06 }],
      ["43000019", { totalDebe: 60766.2, totalHaber: 0 }],
      ["60100000", { totalDebe: 2746.85, totalHaber: 0 }],
      ["60100001", { totalDebe: 5217.42, totalHaber: 0 }],
      ["62120000", { totalDebe: 6100.06, totalHaber: 0 }],
    ])
    const names = new Map([
      ["41000002", "GALP ENERGIA ESPAÑA SAU"],
      ["41000035", "ASOROTNIC SL"],
      ["43000019", "FERNANDEZ VEGA PAULA GABRIELA"],
      ["60100001", "COMPRA MATERIAL DE CONSTRUCCI"],
    ])

    const subcuentas = buildMovementBalanceRows(movements, names, "SUBCUENTAS")
    expect(subcuentas.find((row) => row.cuenta === "41000002")?.label).toBe("GALP ENERGIA ESPAÑA SAU")
    expect(subcuentas.find((row) => row.cuenta === "41000035")?.label).toBe("ASOROTNIC SL")
    expect(subcuentas.find((row) => row.cuenta === "60100000")?.totalDebe).toBe(2746.85)
    expect(subcuentas.find((row) => row.cuenta === "60100001")?.totalDebe).toBe(5217.42)

    const nivel4 = buildMovementBalanceRows(movements, names, "NIVEL_4")
    expect(nivel4.find((row) => row.cuenta === "4100")?.totalHaber).toBe(6268.21)
    expect(nivel4.find((row) => row.cuenta === "4300")?.totalDebe).toBe(60766.2)
    expect(nivel4.find((row) => row.cuenta === "6010")?.totalDebe).toBe(7964.27)
    expect(nivel4.find((row) => row.cuenta === "6212")?.totalDebe).toBe(6100.06)
    expect(nivel4.find((row) => row.cuenta === "41000002")).toBeUndefined()

    const nivel3 = buildMovementBalanceRows(movements, names, "NIVEL_3")
    expect(nivel3.find((row) => row.cuenta === "410")?.totalHaber).toBe(6268.21)
    expect(nivel3.find((row) => row.cuenta === "430")?.totalDebe).toBe(60766.2)
    expect(nivel3.find((row) => row.cuenta === "601")?.totalDebe).toBe(7964.27)
    expect(nivel3.find((row) => row.cuenta === "621")?.totalDebe).toBe(6100.06)
    expect(nivel3.map((row) => row.cuenta)).toEqual(["410", "430", "601", "621"])
  })
})
