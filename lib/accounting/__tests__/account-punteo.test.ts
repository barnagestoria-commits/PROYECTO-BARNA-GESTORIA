import { describe, expect, it } from "vitest"
import {
  buildPunteoBalances,
  groupPunteoAccounts,
  indexPunteoStamps,
  lineVisibleInPunteo,
  movePunteoAccount,
  takePunteoStamp,
  type PunteoWindow,
} from "@/lib/accounting/account-punteo"

const yearWindow: PunteoWindow = {
  fromDate: "2026-01-01",
  toDate: "2026-12-31",
  fromAmount: 0,
  toAmount: 0,
}

describe("movePunteoAccount", () => {
  const accounts = [
    { cuenta: "4000001", tickedCount: 2, untickedCount: 0 },
    { cuenta: "4300001", tickedCount: 0, untickedCount: 3 },
    { cuenta: "5720000", tickedCount: 1, untickedCount: 1 },
  ]

  it("walks the chart forward and back", () => {
    expect(movePunteoAccount(accounts, "4000001", "next", "ambos")).toBe("4300001")
    expect(movePunteoAccount(accounts, "5720000", "prev", "ambos")).toBe("4300001")
    expect(movePunteoAccount(accounts, "4000001", "prev", "ambos")).toBeNull()
    expect(movePunteoAccount(accounts, "5720000", "next", "ambos")).toBeNull()
  })

  it("skips accounts that are already fully ticked when the filter is no punteados", () => {
    expect(movePunteoAccount(accounts, "4000001", "next", "no-punteados")).toBe("4300001")
    expect(movePunteoAccount(accounts, "4300001", "next", "no-punteados")).toBe("5720000")
    expect(movePunteoAccount(accounts, "", "first", "no-punteados")).toBe("4300001")
  })
})

describe("lineVisibleInPunteo", () => {
  const line = { fecha: "2026-03-02", debe: 453, haber: 0, punteado: false }

  it("hides a ticked line from the unticked filter and keeps it in ambos", () => {
    expect(lineVisibleInPunteo(line, yearWindow, "no-punteados")).toBe(true)
    expect(lineVisibleInPunteo({ ...line, punteado: true }, yearWindow, "no-punteados")).toBe(false)
    expect(lineVisibleInPunteo({ ...line, punteado: true }, yearWindow, "ambos")).toBe(true)
  })

  it("respects the amount window and treats 0 to 0 as every amount", () => {
    expect(lineVisibleInPunteo(line, { ...yearWindow, fromAmount: 500 }, "ambos")).toBe(false)
    expect(lineVisibleInPunteo(line, yearWindow, "ambos")).toBe(true)
  })
})

describe("buildPunteoBalances", () => {
  it("keeps the ticked position apart from the ledger position", () => {
    const balances = buildPunteoBalances(
      [
        { fecha: "2026-01-10", debe: 100, haber: 0, punteado: true },
        { fecha: "2026-03-02", debe: 453, haber: 0, punteado: false },
      ],
      { contable: 0, punteado: 0 },
      yearWindow,
    )

    expect(balances.contable).toMatchObject({
      saldoInicial: 0,
      acumDebe: 553,
      acumHaber: 0,
      saldoFinal: 553,
    })
    expect(balances.punteado).toMatchObject({
      saldoInicial: 0,
      acumDebe: 100,
      acumHaber: 0,
      saldoFinal: 100,
    })
  })
})

describe("groupPunteoAccounts", () => {
  it("orders accounts and counts ticked lines inside the window", () => {
    expect(
      groupPunteoAccounts(
        [
          { cuenta: "572.0000", fecha: "2026-02-01", debe: 10, haber: 0, punteado: false },
          { cuenta: "430.0001", fecha: "2026-02-01", debe: 10, haber: 0, punteado: true },
          { cuenta: "430.0001", fecha: "2025-12-31", debe: 10, haber: 0, punteado: false },
        ],
        yearWindow,
      ),
    ).toEqual([
      { cuenta: "4300001", tickedCount: 1, untickedCount: 0 },
      { cuenta: "5720000", tickedCount: 0, untickedCount: 1 },
    ])
  })
})

describe("takePunteoStamp", () => {
  it("keeps each ticked line when the entry is saved again", () => {
    const pool = indexPunteoStamps([
      {
        cuenta: "430.0001",
        concepto: "Factura 1",
        debe: 100,
        haber: 0,
        punteado: true,
        punteadoAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        cuenta: "5720000",
        concepto: "Cobro",
        debe: 0,
        haber: 100,
        punteado: false,
        punteadoAt: null,
      },
    ])

    expect(
      takePunteoStamp(pool, { cuenta: "4300001", concepto: "Factura 1", debe: 100, haber: 0 })
        ?.punteado,
    ).toBe(true)
    expect(
      takePunteoStamp(pool, { cuenta: "572.0000", concepto: "Cobro", debe: 0, haber: 100 }),
    ).toBeNull()
  })
})
