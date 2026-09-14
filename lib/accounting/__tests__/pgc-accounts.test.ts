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
    expect(codes).toContain("4300002")
    expect(codes).toContain("4300001")
  })

  it("finds a subaccount by its name", () => {
    const results = searchChartAccounts("Tipay", { thirdParties, ledgerSubaccounts })

    expect(results.some((account) => account.name === "Tipay Solutions SL")).toBe(true)
  })

  it("includes ledger subaccounts by parent code", () => {
    const results = searchChartAccounts("601", { thirdParties, ledgerSubaccounts })

    expect(results.some((account) => account.accountCode === "6010001")).toBe(true)
  })
})
