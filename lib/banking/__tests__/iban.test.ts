import { describe, expect, it } from "vitest"
import { formatIbanDisplay, isValidIban, parseOptionalIban } from "@/lib/banking/iban"

describe("iban", () => {
  it("accepts a Spanish IBAN and stores it without spaces", () => {
    expect(isValidIban("ES91 2100 0418 4502 0005 1332")).toBe(true)
    expect(parseOptionalIban("ES91 2100 0418 4502 0005 1332")).toBe("ES9121000418450200051332")
    expect(formatIbanDisplay("ES9121000418450200051332")).toBe("ES91 2100 0418 4502 0005 1332")
  })

  it("rejects a tampered control digit and treats an empty value as cleared", () => {
    expect(isValidIban("ES00 2100 0418 4502 0005 1332")).toBe(false)
    expect(() => parseOptionalIban("ES00")).toThrow(/IBAN/)
    expect(parseOptionalIban("")).toBeNull()
    expect(parseOptionalIban(undefined)).toBeUndefined()
  })
})
