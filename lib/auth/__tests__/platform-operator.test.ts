import { describe, expect, it } from "vitest"
import { isPlatformOperatorEmail, userIsPlatformOperator } from "@/lib/auth/platform-operator"

describe("platform operator", () => {
  it("treats the Taxlyn contact mailbox as operator", () => {
    expect(isPlatformOperatorEmail("infotaxlyn@gmail.com")).toBe(true)
    expect(isPlatformOperatorEmail("  InfoTaxlyn@gmail.com ")).toBe(true)
  })

  it("does not treat a customer mailbox as operator", () => {
    expect(isPlatformOperatorEmail("juan@empresa.com")).toBe(false)
    expect(isPlatformOperatorEmail("admin@gestoria.com")).toBe(false)
    expect(userIsPlatformOperator({ email: "juan@empresa.com", isPlatformOperator: false })).toBe(
      false,
    )
  })

  it("honors the stored flag even when the email is not in the default list", () => {
    expect(userIsPlatformOperator({ email: "soporte@ejemplo.com", isPlatformOperator: true })).toBe(
      true,
    )
  })
})
