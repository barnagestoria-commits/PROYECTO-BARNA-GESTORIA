import { describe, expect, it } from "vitest"
import {
  catalogLedgerAccountName,
  formatAccountCodeWithName,
  resolveInvoiceLedgerAccountName,
} from "@/lib/accounting/invoice-account-label"

describe("formatAccountCodeWithName", () => {
  it("shows the PGC code next to the account name like tipo de ficha", () => {
    expect(formatAccountCodeWithName("410.0004", "17 HAPPY HOUSE, S.L.")).toBe(
      "410.0004 · 17 HAPPY HOUSE, S.L.",
    )
    expect(formatAccountCodeWithName("629.0001", "Otros servicios")).toBe(
      "629.0001 · Otros servicios",
    )
  })
})

describe("resolveInvoiceLedgerAccountName", () => {
  it("uses the catalog name for a generic expense account", () => {
    expect(resolveInvoiceLedgerAccountName("629", "expense")).toBe("Otros servicios")
    expect(catalogLedgerAccountName("629.0000", "expense")).toBe("Otros servicios")
  })

  it("keeps the specific name after creating a subaccount", () => {
    expect(resolveInvoiceLedgerAccountName("629.0001", "expense", "Parking centro")).toBe(
      "Parking centro",
    )
  })

  it("falls back to the parent expense name before the subaccount exists", () => {
    expect(resolveInvoiceLedgerAccountName("629.0001", "expense")).toBe("Otros servicios")
  })

  it("resolves income accounts the same way", () => {
    expect(resolveInvoiceLedgerAccountName("705.1", "income")).toBe(
      "Prestaciones de servicios",
    )
  })
})
