import { describe, expect, it } from "vitest"
import {
  resolveEditedAccountCode,
  resolvePreferredAccountCode,
} from "@/lib/accounting/account-code-edit"

describe("resolveEditedAccountCode", () => {
  it("resolves 430.2 and 430.0002 to the same client subaccount", () => {
    expect(resolveEditedAccountCode("430.2", "4300003")).toBe("4300002")
    expect(resolveEditedAccountCode("430.0002", "4300003")).toBe("4300002")
    expect(resolveEditedAccountCode("4300002", "430.0003")).toBe("4300002")
  })

  it("keeps the same code when the user does not change it", () => {
    expect(resolveEditedAccountCode("430.0003", "4300003")).toBe("4300003")
  })

  it("rejects moving a client account to another group", () => {
    expect(() => resolveEditedAccountCode("410.1", "4300003")).toThrow(/grupo 430/)
  })

  it("allows moving a supplier between 400 and 410", () => {
    expect(resolveEditedAccountCode("410.5", "4000002")).toBe("4100005")
    expect(resolveEditedAccountCode("400.3", "4100001")).toBe("4000003")
  })

  it("resolves a preferred new account like 430.2 to 4300002", () => {
    expect(resolvePreferredAccountCode("430.2", "430")).toBe("4300002")
    expect(resolvePreferredAccountCode("430.0002", "430")).toBe("4300002")
  })

  it("keeps a generic PGC account such as 572 without forcing a new subaccount", () => {
    expect(resolveEditedAccountCode("572", "572")).toBe("572")
    expect(resolveEditedAccountCode("572.0000", "572")).toBe("572")
    expect(resolveEditedAccountCode("5720000", "572")).toBe("572")
    expect(resolveEditedAccountCode("572.0000", "572.0000")).toBe("572")
  })

  it("can still open a numbered subaccount from the generic 572", () => {
    expect(resolveEditedAccountCode("572.0001", "572")).toBe("5720001")
    expect(resolveEditedAccountCode("572.1", "572")).toBe("5720001")
  })
})
