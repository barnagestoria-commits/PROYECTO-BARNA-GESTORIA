import { describe, expect, it } from "vitest"
import {
  parseDottedAccountShortcut,
  resolveAccountShortcut,
  unresolvedDottedShortcut,
} from "@/lib/accounting/account-shortcut"

const catcher = {
  accountCode: "41000001",
  name: "Catcher Marketplace SL",
  cif: "B12345678",
  source: "tercero" as const,
}

const galp = {
  accountCode: "41000002",
  name: "GALP ENERGIA",
  source: "tercero" as const,
}

const cliente = {
  accountCode: "43000019",
  name: "Fernandez Vega",
  source: "tercero" as const,
}

describe("account-shortcut", () => {
  it("parses 41.1, 410.1 and 410.00001 as group plus sequence 1", () => {
    expect(parseDottedAccountShortcut("41.1")).toEqual({ group: "41", sequence: 1 })
    expect(parseDottedAccountShortcut("410.1")).toEqual({ group: "410", sequence: 1 })
    expect(parseDottedAccountShortcut("410.00001")).toEqual({ group: "410", sequence: 1 })
    expect(parseDottedAccountShortcut("410")).toBeNull()
  })

  it("resolves 41.1 to the first acreedor subaccount 410.00001", () => {
    const resolved = resolveAccountShortcut("41.1", [catcher, galp, cliente])
    expect(resolved?.accountCode).toBe("41000001")
    expect(resolved?.formattedAccountCode).toBe("410.00001")
    expect(resolved?.name).toBe("Catcher Marketplace SL")
  })

  it("resolves 410.1 and 410.00001 to the same Catcher account", () => {
    expect(resolveAccountShortcut("410.1", [catcher])?.accountCode).toBe("41000001")
    expect(resolveAccountShortcut("410.00001", [catcher])?.accountCode).toBe("41000001")
  })

  it("resolves 430.19 to the matching client subaccount", () => {
    const resolved = resolveAccountShortcut("430.19", [catcher, cliente])
    expect(resolved?.accountCode).toBe("43000019")
    expect(resolved?.name).toBe("Fernandez Vega")
  })

  it("resolves 41.1 even when the subaccount was created with 4 digits after 410", () => {
    const resolved = resolveAccountShortcut("41.1", [
      { accountCode: "4100001", name: "Catcher Marketplace SL", source: "tercero" },
    ])
    expect(resolved?.accountCode).toBe("4100001")
    expect(resolved?.formattedAccountCode).toBe("410.0001")
  })

  it("does not invent a generic 410 when the subaccount does not exist", () => {
    expect(resolveAccountShortcut("41.9", [catcher])).toBeNull()
  })

  it("prefers the named acreedor over a generic 410.0001 ledger slot", () => {
    const resolved = resolveAccountShortcut("41.1", [
      { accountCode: "4100001", name: "Acreedores por prestaciones de servicios", source: "ledger" },
      catcher,
    ])
    expect(resolved?.accountCode).toBe("41000001")
    expect(resolved?.name).toBe("Catcher Marketplace SL")
  })

  it("does not parse 41.1 as the PGC account 411", () => {
    expect(parseDottedAccountShortcut("41.1")?.group).toBe("41")
    expect(resolveAccountShortcut("41.1", [catcher])?.accountCode).not.toBe("411")
    const fallback = unresolvedDottedShortcut({ group: "41", sequence: 1 })
    expect(fallback.fallbackAccountCode).toBe("4100001")
    expect(fallback.formattedAccountCode).toBe("410.0001")
    expect(fallback.parentCode).toBe("410")
  })
})
