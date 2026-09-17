import { describe, expect, it } from "vitest"
import {
  accountNeedsRegistration,
  expandCanonicalSubaccountCode,
} from "@/lib/accounting/account-exists-service"
import {
  canonicalAccountDigits,
  canonicalizeStoredAccountCode,
  formatAccountCodeForUi,
  needsCanonicalAccountRepair,
} from "@/lib/accounting/canonical-account-code"
import { normalizeEntryLines } from "@/lib/accounting/entry-payload"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"

describe("expandCanonicalSubaccountCode", () => {
  it("pads 628.1 to the same format as 410.0002", () => {
    expect(expandCanonicalSubaccountCode("628.1")).toBe("6280001")
    expect(formatAccountCodeDisplay(expandCanonicalSubaccountCode("628.1"))).toBe("628.0001")
  })

  it("keeps an already padded subaccount", () => {
    expect(expandCanonicalSubaccountCode("628.0001")).toBe("6280001")
    expect(expandCanonicalSubaccountCode("6280001")).toBe("6280001")
  })

  it("expands a short numeric suffix without a dot", () => {
    expect(expandCanonicalSubaccountCode("6281")).toBe("6280001")
  })

  it("does not change a 3-digit PGC account", () => {
    expect(expandCanonicalSubaccountCode("628")).toBe("628")
  })

  it("pads income accounts the same way", () => {
    expect(formatAccountCodeDisplay(expandCanonicalSubaccountCode("705.1"))).toBe("705.0001")
  })
})

describe("canonical account display and storage", () => {
  it("shows 6281 as 628.0001 and 472 as 472.0000", () => {
    expect(formatAccountCodeForUi("6281")).toBe("628.0001")
    expect(formatAccountCodeForUi("628.1")).toBe("628.0001")
    expect(formatAccountCodeForUi("472")).toBe("472.0000")
    expect(formatAccountCodeForUi("410.0002")).toBe("410.0002")
  })

  it("stores 628.1 / 6281 as 628.0001 without persisting 6281", () => {
    expect(canonicalizeStoredAccountCode("6281")).toBe("628.0001")
    expect(canonicalizeStoredAccountCode("628.1")).toBe("628.0001")
    expect(canonicalizeStoredAccountCode("472")).toBe("472")
    expect(canonicalizeStoredAccountCode("472.0000")).toBe("472")
    expect(needsCanonicalAccountRepair("6281")).toBe(true)
    expect(needsCanonicalAccountRepair("628.0001")).toBe(false)
    expect(needsCanonicalAccountRepair("472")).toBe(false)
  })

  it("canonicalizes asiento lines so OCR 628.1 is not saved as 6281", () => {
    const result = normalizeEntryLines([
      { cuenta: "410.0002", concepto: "Proveedor", debe: 0, haber: 15.04 },
      { cuenta: "472", concepto: "IVA", debe: 2.61, haber: 0 },
      { cuenta: "628.1", concepto: "Gasto", debe: 12.43, haber: 0 },
    ])
    if ("error" in result) throw new Error(result.error)
    expect(result.lines.map((line) => line.cuenta)).toEqual(["410.0002", "472", "628.0001"])
  })
})

describe("generic PGC accounts like 572", () => {
  it("collapses visual .0000 padding back to the generic PGC code", () => {
    expect(canonicalAccountDigits("572")).toBe("572")
    expect(canonicalAccountDigits("572.0000")).toBe("572")
    expect(canonicalAccountDigits("5720000")).toBe("572")
    expect(canonicalAccountDigits("472.0000")).toBe("472")
    expect(canonicalAccountDigits("4751.0000")).toBe("4751")
  })

  it("keeps a real subaccount like 572.0001", () => {
    expect(canonicalAccountDigits("572.0001")).toBe("5720001")
    expect(canonicalAccountDigits("572.1")).toBe("5720001")
  })

  it("does not ask to register a generic PGC account already in the chart", () => {
    expect(accountNeedsRegistration("572")).toBe(false)
    expect(accountNeedsRegistration("572.0000")).toBe(false)
    expect(accountNeedsRegistration("5720000")).toBe(false)
    expect(accountNeedsRegistration("472.0000")).toBe(false)
  })

  it("still asks to register a new bank subaccount", () => {
    expect(accountNeedsRegistration("572.0001")).toBe(true)
    expect(accountNeedsRegistration("572.1")).toBe(true)
  })
})
