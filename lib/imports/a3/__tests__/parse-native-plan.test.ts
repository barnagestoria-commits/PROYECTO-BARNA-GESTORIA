import { describe, expect, it } from "vitest"
import { resolveCuProviderSubaccount } from "@/lib/imports/a3/parse-native-plan"

describe("resolveCuProviderSubaccount", () => {
  it("reads subaccount from u168 (FORKSTONE → 41000248)", () => {
    const record = Buffer.alloc(512)
    record.writeUInt16LE(248, 168)
    expect(resolveCuProviderSubaccount(record)).toBe(248)
  })

  it("derives subaccount from u156 when u168 is zero (FULLEXPO → 41000248)", () => {
    const record = Buffer.alloc(512)
    record.writeUInt16LE(309, 156)
    expect(resolveCuProviderSubaccount(record)).toBe(248)
  })

  it("ignores ASCII padding mistaken for u156 (0x2020)", () => {
    const record = Buffer.alloc(512)
    record.writeUInt16LE(8224, 156)
    expect(resolveCuProviderSubaccount(record)).toBeNull()
  })
})
