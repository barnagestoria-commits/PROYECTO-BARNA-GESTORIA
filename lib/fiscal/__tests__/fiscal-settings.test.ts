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
    expect(getEnabledModels(DEFAULT_SETTINGS_BY_PROFILE.PYME)).toContain("202")
    expect(DEFAULT_SETTINGS_BY_PROFILE.PYME.model202Modality).toBe("ART_40_2")
    expect(DEFAULT_SETTINGS_BY_PROFILE.GRAN_EMPRESA.model202Modality).toBe("ART_40_3")
    expect(getEnabledModels(DEFAULT_SETTINGS_BY_PROFILE.AUTONOMO)).not.toContain("202")
    expect(getEnabledModels(DEFAULT_SETTINGS_BY_PROFILE.GRAN_EMPRESA)).toContain("202")
  })
})
