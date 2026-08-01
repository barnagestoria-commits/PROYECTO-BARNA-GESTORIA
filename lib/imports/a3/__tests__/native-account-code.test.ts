import { describe, expect, it } from "vitest"
import {
  decodeCuProviderNineDigitField,
  decodeNativeNineDigitAccountField,
  decodeSnnsAccountField,
  formatA3ProviderAccount,
  isGenericProviderCode,
  isProviderAccountCode,
  isResolvedProviderAccountCode,
  isValidPgcAccountCode,
  padAccountCode12,
} from "@/lib/imports/a3/native-account-code"

describe("formatA3ProviderAccount", () => {
  it("formats native A3 provider subaccounts", () => {
    expect(formatA3ProviderAccount(248)).toBe("410002480000")
    expect(formatA3ProviderAccount(98)).toBe("410000980000")
  })
})

describe("isProviderAccountCode", () => {
  it("accepts grupos 400, 410 y subplan 4100", () => {
    expect(isProviderAccountCode("410002480000")).toBe(true)
    expect(isProviderAccountCode("400000000523")).toBe(true)
    expect(isProviderAccountCode("410000000123")).toBe(true)
    expect(isProviderAccountCode("400000000000")).toBe(false)
  })

  it("rejects grupos PGC inválidos como 800", () => {
    expect(isProviderAccountCode("800000000000")).toBe(false)
    expect(isValidPgcAccountCode("800000000000")).toBe(false)
    expect(decodeNativeNineDigitAccountField("100800000")).toBeNull()
  })
})

describe("isResolvedProviderAccountCode", () => {
  it("detects real provider codes from native export", () => {
    expect(isResolvedProviderAccountCode("410002480000")).toBe(true)
    expect(isResolvedProviderAccountCode("400000000300")).toBe(true)
  })
})

describe("decodeCuProviderNineDigitField", () => {
  it("decodes 4100XXXX from XXX400YYY when YYY is not 000", () => {
    expect(decodeCuProviderNineDigitField("100400100")).toBe("410001000000")
    expect(decodeCuProviderNineDigitField("100400248")).toBe("410002480000")
  })

  it("returns null for provider templates XXX400000", () => {
    expect(decodeCuProviderNineDigitField("100400000")).toBeNull()
    expect(decodeCuProviderNineDigitField("300400000")).toBeNull()
  })
})

describe("decodeNativeNineDigitAccountField", () => {
  it("does not treat XXX400000 templates as subaccount 100", () => {
    expect(decodeNativeNineDigitAccountField("100400000")).toBeNull()
    expect(decodeNativeNineDigitAccountField("300400000")).toBeNull()
  })

  it("decodes IVA accounts from nine-digit fields", () => {
    expect(decodeNativeNineDigitAccountField("100472000")).toBe("472000000100")
  })

  it("returns null for invalid fields", () => {
    expect(decodeNativeNineDigitAccountField("12345678")).toBeNull()
    expect(decodeNativeNineDigitAccountField("100999100")).toBeNull()
  })
})

describe("decodeSnnsAccountField", () => {
  it("extracts 400 subaccount from SNNS block", () => {
    expect(decodeSnnsAccountField("00400000010000000")).toBe("400000000100")
  })
})

describe("isGenericProviderCode", () => {
  it("detects generic provider placeholders", () => {
    expect(isGenericProviderCode("400000000000")).toBe(true)
    expect(isGenericProviderCode("400000000100")).toBe(false)
  })
})

describe("padAccountCode12", () => {
  it("pads dotted plan codes to 12 digits", () => {
    expect(padAccountCode12("849.9")).toBe("849900000000")
    expect(padAccountCode12("505.5")).toBe("505500000000")
  })
})
