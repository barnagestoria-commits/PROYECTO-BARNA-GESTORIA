import { describe, expect, it } from "vitest"
import { shouldBroadcastCertificateChange } from "@/lib/settings/certificate-notify"

describe("certificate parent notify", () => {
  it("does not notify the parent after the initial fetch", () => {
    expect(shouldBroadcastCertificateChange("fetch")).toBe(false)
  })

  it("notifies the parent after the user uploads or deletes a certificate", () => {
    expect(shouldBroadcastCertificateChange("save")).toBe(true)
    expect(shouldBroadcastCertificateChange("delete")).toBe(true)
  })
})
