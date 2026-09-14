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

  it("resolves a preferred new account like 430.2 to 4300002", () => {
    expect(resolvePreferredAccountCode("430.2", "430")).toBe("4300002")
    expect(resolvePreferredAccountCode("430.0002", "430")).toBe("4300002")
  })
})
