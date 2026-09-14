import { describe, expect, it } from "vitest"
import { accountMatchesQuery } from "@/lib/reports/format"

describe("accountMatchesQuery", () => {
  it("matches a subaccount when querying its group", () => {
    expect(accountMatchesQuery("410.00001", "410")).toBe(true)
    expect(accountMatchesQuery("41000001", "410")).toBe(true)
    expect(accountMatchesQuery("410", "410")).toBe(true)
  })

  it("does not mix sibling accounts", () => {
    expect(accountMatchesQuery("41000001", "411")).toBe(false)
    expect(accountMatchesQuery("62900001", "410")).toBe(false)
    expect(accountMatchesQuery("410", "41000001")).toBe(false)
  })
})
