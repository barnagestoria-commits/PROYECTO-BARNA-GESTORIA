import { describe, expect, it } from "vitest"
import {
  decodeNativeNineDigitAccountField,
  decodeSnnsAccountField,
  isGenericProviderCode,
  padAccountCode12,
} from "@/lib/imports/a3/native-account-code"

describe("decodeNativeNineDigitAccountField", () => {
  it("decodes vendor subaccounts from CU.DAT nine-digit fields", () => {
    expect(decodeNativeNineDigitAccountField("100400100")).toBe("400000000100")
    expect(decodeNativeNineDigitAccountField("300400000")).toBe("400000000300")
    expect(decodeNativeNineDigitAccountField("100400000")).toBe("400000000100")
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
