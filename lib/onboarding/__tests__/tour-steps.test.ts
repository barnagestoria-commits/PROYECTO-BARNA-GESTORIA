import { describe, expect, it } from "vitest"
import { getTourStepsForProfile } from "@/lib/onboarding/types"

describe("guía de alta", () => {
  it("empieza por la ficha, el certificado y el 036", () => {
    const steps = getTourStepsForProfile("empresa")
    expect(steps.map((step) => step.id).slice(0, 4)).toEqual([
      "profile",
      "certificate",
      "census",
      "profile-rest",
    ])
    expect(steps[0]?.route).toBe("/configuracion")
    expect(steps[1]?.route).toBe("/configuracion/certificado")
    expect(steps[2]?.target).toContain("onboarding-census")
  })

  it("en la gestoría sigue por la cartera y no pide Verifactu", () => {
    const steps = getTourStepsForProfile("gestoria")
    expect(steps.map((step) => step.id)).not.toContain("verifactu")
    expect(steps.find((step) => step.id === "accounts")?.route).toBe(
      "/dashboard/contabilidad/clientes-gestoria",
    )
  })
})
