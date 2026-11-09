import { describe, expect, it } from "vitest"
import { resolveTourAdvance } from "@/lib/onboarding/tour-advance"
import { tourRouteMatches } from "@/lib/onboarding/tour-route"
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

  it("no confunde el certificado con la ficha de configuración", () => {
    expect(tourRouteMatches("/configuracion/certificado", "/configuracion")).toBe(false)
    expect(tourRouteMatches("/configuracion", "/configuracion")).toBe(true)
    expect(tourRouteMatches("/dashboard/contabilidad/clientes-gestoria", "/dashboard/contabilidad")).toBe(
      false,
    )
  })

  it("Siguiente avanza un solo paso y no se duplica con TARGET_NOT_FOUND", () => {
    const base = { currentIndex: 0, total: 8, moving: false }
    expect(resolveTourAdvance({ ...base, eventType: "step:after", action: "next" })).toBe(1)
    expect(resolveTourAdvance({ ...base, eventType: "error:target_not_found", action: "next" })).toBe(
      null,
    )
    expect(resolveTourAdvance({ ...base, eventType: "step:after", action: "next", moving: true })).toBe(
      null,
    )
    expect(resolveTourAdvance({ ...base, eventType: "step:after", action: "stop" })).toBe(null)
    expect(
      resolveTourAdvance({ ...base, currentIndex: 1, eventType: "step:after", action: "prev" }),
    ).toBe(0)
  })

  it("el último Siguiente cierra el tour y no vuelve al paso 1", () => {
    expect(
      resolveTourAdvance({
        eventType: "step:after",
        action: "next",
        currentIndex: 7,
        total: 8,
        moving: false,
      }),
    ).toBe("complete")
    expect(
      resolveTourAdvance({
        eventType: "tour:end",
        action: "next",
        currentIndex: 7,
        total: 8,
        moving: false,
      }),
    ).toBe("complete")
  })

  it("en la gestoría sigue por la cartera y no pide Verifactu", () => {
    const steps = getTourStepsForProfile("gestoria")
    expect(steps.map((step) => step.id)).not.toContain("verifactu")
    expect(steps.find((step) => step.id === "accounts")?.route).toBe(
      "/dashboard/contabilidad/clientes-gestoria",
    )
  })
})
