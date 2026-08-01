import { describe, expect, it } from "vitest"
import {
  buildUniqueVendorAccountMap,
  lookupUniqueVendorAccount,
} from "@/lib/imports/a3/native-vendor-accounts"

describe("buildUniqueVendorAccountMap", () => {
  it("preserves real 400/4100 provider codes from A3", () => {
    const map = buildUniqueVendorAccountMap([
      { accountCode: "410002480000", name: "FULLEXPO EXHIBITS, SL" },
      { accountCode: "400000000523", name: "FORKSTONE SL" },
    ])

    expect(lookupUniqueVendorAccount(map, "FULLEXPO EXHIBITS, SL")).toBe("410002480000")
    expect(lookupUniqueVendorAccount(map, "FORKSTONE SL")).toBe("400000000523")
  })

  it("assigns distinct provider codes when A3 reuses 400000000100", () => {
    const map = buildUniqueVendorAccountMap([
      { accountCode: "400000000100", name: "FULLEXPO EXHIBITS, SL" },
      { accountCode: "400000000100", name: "FORKSTONE SL" },
      { accountCode: "400000000300", name: "OTRO PROVEEDOR SA" },
    ])

    const full = lookupUniqueVendorAccount(map, "FULLEXPO EXHIBITS, SL")
    const fork = lookupUniqueVendorAccount(map, "FORKSTONE SL")
    const otro = lookupUniqueVendorAccount(map, "OTRO PROVEEDOR SA")

    expect(full).toBeTruthy()
    expect(fork).toBeTruthy()
    expect(otro).toBe("400000000300")
    expect(full).not.toBe(fork)
    expect(full).not.toBe("400000000000")
    expect(fork).not.toBe("400000000000")
  })
})
