import { describe, expect, it } from "vitest"
import { searchChartAccounts } from "@/lib/accounting/pgc-accounts"

describe("searchChartAccounts", () => {
  const thirdParties = [
    {
      accountCode: "4300002",
      formattedAccountCode: "430.0002",
      name: "Tipay Solutions SL",
      cif: "B12345678",
    },
    {
      accountCode: "4300001",
      formattedAccountCode: "430.0001",
      name: "Retail Servicer Spain SL",
    },
  ]
  const ledgerSubaccounts = [
    {
      id: "1",
      parentCode: "601",
      name: "Compras mercaderías",
      accountCode: "6010001",
      formattedAccountCode: "601.0001",
    },
  ]

  it("includes opened client subaccounts when searching 430 or 430.", () => {
    const byCode = searchChartAccounts("430.", { thirdParties, ledgerSubaccounts })
    const codes = byCode.map((account) => account.accountCode.replace(/\D/g, ""))

    expect(codes).toContain("430")
    expect(byCode.some((account) => account.source === "pgc" && account.code === "430.0000")).toBe(true)
    expect(codes).toContain("4300002")
    expect(codes).toContain("4300001")
  })

  it("finds a subaccount by its name", () => {
    const results = searchChartAccounts("Tipay", { thirdParties, ledgerSubaccounts })

    expect(results.some((account) => account.name === "TIPAY SOLUTIONS SL")).toBe(true)
  })

  it("includes ledger subaccounts by parent code", () => {
    const results = searchChartAccounts("601", { thirdParties, ledgerSubaccounts })

    expect(results.some((account) => account.accountCode === "6010001")).toBe(true)
  })

  it("offers a typed freed subaccount like 410.0003 as a transfer destination", () => {
    const results = searchChartAccounts("410.0003", { thirdParties, ledgerSubaccounts })
    const available = results.find((account) => account.accountCode.replace(/\D/g, "") === "4100003")

    expect(available).toMatchObject({
      code: "410.0003",
      name: "Cuenta disponible",
      source: "pgc",
    })
  })

  it("keeps a live ficha instead of the generic available row", () => {
    const results = searchChartAccounts("410.0003", {
      thirdParties: [
        {
          accountCode: "4100003",
          formattedAccountCode: "410.0003",
          name: "ESTACION SERVICIO MATARO S.L.",
        },
      ],
      ledgerSubaccounts,
    })
    const match = results.find((account) => account.accountCode.replace(/\D/g, "") === "4100003")

    expect(match?.source).toBe("tercero")
    expect(match?.name).toBe("ESTACION SERVICIO MATARO S.L.")
  })
})
