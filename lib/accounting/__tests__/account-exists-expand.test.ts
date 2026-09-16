import { describe, expect, it } from "vitest"
import { expandCanonicalSubaccountCode } from "@/lib/accounting/account-exists-service"
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
