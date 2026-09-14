import { describe, expect, it } from "vitest"
import {
  DEFAULT_SETTINGS_BY_PROFILE,
  getEnabledModels,
  inferClientProfile,
} from "@/lib/fiscal/fiscal-settings"

describe("inferClientProfile", () => {
  it("enables the autónomo preset for final clients and personas físicas", () => {
    expect(inferClientProfile({ accountType: "CLIENTE_FINAL" })).toBe("AUTONOMO")
    expect(inferClientProfile({ entityType: "PERSONA_FISICA" })).toBe("AUTONOMO")
    expect(getEnabledModels(DEFAULT_SETTINGS_BY_PROFILE.AUTONOMO)).toContain("130")
  })

  it("keeps companies on the PYME preset without modelo 130", () => {
    expect(inferClientProfile({ accountType: "EMPRESA" })).toBe("PYME")
    expect(getEnabledModels(DEFAULT_SETTINGS_BY_PROFILE.PYME)).not.toContain("130")
  })
})
