import { describe, expect, it } from "vitest"
import {
  formatAccountCodeDisplay,
  formatAccountCodeStored,
} from "@/lib/accounting/third-party-types"

describe("formatAccountCodeDisplay", () => {
  it("pads predetermined PGC groups with the same four zeros as opened subaccounts", () => {
    expect(formatAccountCodeDisplay("400")).toBe("400.0000")
    expect(formatAccountCodeDisplay("410")).toBe("410.0000")
    expect(formatAccountCodeDisplay("430")).toBe("430.0000")
    expect(formatAccountCodeDisplay("472")).toBe("472.0000")
  })

  it("keeps opened subaccounts as group plus four-digit sequence", () => {
    expect(formatAccountCodeDisplay("4000001")).toBe("400.0001")
    expect(formatAccountCodeDisplay("410.0002")).toBe("410.0002")
    expect(formatAccountCodeDisplay("6280001")).toBe("628.0001")
  })

  it("pads four-digit PGC accounts without turning them into a 3+4 subaccount", () => {
    expect(formatAccountCodeDisplay("4751")).toBe("4751.0000")
  })
})

describe("formatAccountCodeStored", () => {
  it("does not persist the visual .0000 padding of a PGC group", () => {
    expect(formatAccountCodeStored("400")).toBe("400")
    expect(formatAccountCodeStored("400.0000")).toBe("400")
    expect(formatAccountCodeStored("472.0000")).toBe("472")
    expect(formatAccountCodeStored("4751.0000")).toBe("4751")
  })

  it("persists real subaccounts with the dotted 3+4 form", () => {
    expect(formatAccountCodeStored("4100001")).toBe("410.0001")
    expect(formatAccountCodeStored("410.0001")).toBe("410.0001")
  })
})
