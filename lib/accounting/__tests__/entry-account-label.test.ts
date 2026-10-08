import { describe, expect, it } from "vitest"
import { describeEntryAccountLabel, describeEntryAccountLabels } from "@/lib/accounting/entry-account-label"

describe("describeEntryAccountLabel", () => {
  const parties = [{ accountCode: "4300001", name: "Retail Servicer Spain SL", cif: "B123" }]
  const ledgers = [{ accountCode: "7050000", name: "Prestaciones de servicios" }]

  it("shows the third-party name on a client line", () => {
    expect(describeEntryAccountLabel("430.0001", parties, ledgers)).toBe(
      "430.0001 · RETAIL SERVICER SPAIN SL",
    )
  })

  it("shows the ledger name before the generic chart label", () => {
    expect(describeEntryAccountLabel("705.0000", parties, ledgers)).toBe(
      "705.0000 · PRESTACIONES DE SERVICIOS",
    )
  })

  it("falls back to the chart of accounts when the subaccount has no own name", () => {
    expect(describeEntryAccountLabel("477.0000", [], [])).toBe(
      "477.0000 · HACIENDA PÚBLICA, IVA REPERCUTIDO",
    )
  })

  it("resolves a dotted shortcut to the same client", () => {
    expect(describeEntryAccountLabel("430.1", parties, ledgers)).toBe(
      "430.0001 · RETAIL SERVICER SPAIN SL",
    )
  })

  it("stays empty until there is an account", () => {
    expect(describeEntryAccountLabel("", parties, ledgers)).toBeNull()
    expect(describeEntryAccountLabel("EX", parties, ledgers)).toBeNull()
  })
})

describe("describeEntryAccountLabels", () => {
  it("joins every distinct account of a saved entry", () => {
    const label = describeEntryAccountLabels(
      ["430.0001", "477.0000", "705.0000"],
      [{ accountCode: "4300001", name: "Cliente SL" }],
      [],
    )
    expect(label).toBe(
      "430.0001 · CLIENTE SL · 477.0000 · HACIENDA PÚBLICA, IVA REPERCUTIDO · 705.0000 · PRESTACIONES DE SERVICIOS",
    )
  })
})
