import { describe, expect, it } from "vitest"
import { emailCodeMatches, hashEmailCode, trustedDeviceExpiry } from "@/lib/auth/email-two-factor"
import { TRUSTED_DEVICE_ACCEPTANCE, TRUSTED_DEVICE_DAYS } from "@/lib/auth/trusted-device-terms"

describe("verificación por correo", () => {
  it("reconoce el código y rechaza otro", () => {
    const hash = hashEmailCode("123456")
    expect(emailCodeMatches("123456", hash)).toBe(true)
    expect(emailCodeMatches("000000", hash)).toBe(false)
  })

  it("caduca el dispositivo recordado a los 90 días", () => {
    const from = new Date("2026-11-14T00:00:00.000Z")
    const expires = trustedDeviceExpiry(from)
    expect(expires.toISOString().slice(0, 10)).toBe("2027-02-12")
    expect(TRUSTED_DEVICE_DAYS).toBe(90)
  })

  it("deja por escrito la responsabilidad del dispositivo", () => {
    expect(TRUSTED_DEVICE_ACCEPTANCE).toMatch(/tu responsabilidad/)
    expect(TRUSTED_DEVICE_ACCEPTANCE).toMatch(/no responde/)
  })
})
